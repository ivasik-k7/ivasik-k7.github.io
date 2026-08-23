import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "@/engine";
import {
  AO,
  Bev,
  bevelPaths,
  dth,
  Light,
  M,
  PixelText,
  pxPath,
  type Rect,
  steppedEllipse,
  textWidth,
  tiers,
} from "@/engine/scene/pixelKit";
import { Juice, MinigameShell, makeParticlePool } from "./kit";

/**
 * BANKOMAT — the cash machine on block 16, close up.
 *
 * A minigame in the same sense the machine is a game: you against a queue of
 * screens designed in 2004. The drawing follows the game's volumetric rules —
 * every box carries its bevel edge-light, the screen sits in a recessed
 * graphite bezel with its own green glow pooled on the fascia, the keypad
 * keys are individually raised and physically depress, and the whole face
 * throws a stepped shadow onto the wall behind it.
 *
 * The machine is honest post-Soviet street furniture: it connects slowly, it
 * accepts any PIN without checking (it is your card, after all), it sometimes
 * only has fifties, and the receipt question is rhetorical.
 */

/* logical canvas */
const W = 300;
const H = 190;
/** the machine is bolted to the wall at block 16; the pavement runs beneath */
const KERB_Y = 162;

/* the machine face geometry, in logical px */
const BODY: Rect = [52, 8, 136, 154];
const SCREEN_BEZEL: Rect = [68, 22, 104, 54];
const SCREEN: Rect = [74, 27, 92, 44];
const KEY_W = 14;
const KEY_H = 8;
const KEYS_X = 76;
const KEYS_Y = 84;
const KEY_GAP = 3;
const CARD_SLOT: Rect = [138, 86, 34, 7];
const CASH_SLOT: Rect = [76, 140, 88, 9];

const GREEN = "#7ec97e";
const GREEN_DIM = "#3f7a46";
const SCREEN_BG = "#0b1a10";

type Phase =
  | "idle"
  | "connecting"
  | "pin"
  | "menu"
  | "amount"
  | "counting"
  | "cash"
  | "balance"
  | "eject";

const MENU = ["WYPŁATA", "SALDO", "ZWROT KARTY"] as const;
const AMOUNTS = [50, 100, 200] as const;

export function Bankomat({
  money,
  account,
  onWithdraw,
  onClose,
}: {
  money: number;
  account: number;
  onWithdraw: (amount: number) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pin, setPin] = useState("");
  const [cursor, setCursor] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [cash, setCash] = useState(0);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  /** the closing line, spoken on the plate like every other minigame's */
  const [verdict, setVerdict] = useState<string | null>(null);
  const stageRef = useRef<SVGGElement | null>(null);
  const queueRef = useRef<SVGGElement | null>(null);
  const juice = useRef(new Juice()).current;
  const bits = useRef(makeParticlePool(24)).current;
  /* the man behind you arrives once you have been at this a while, and the
     machine keeps its own slow clock so the pool has something to drive it */
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const { dx, dy } = juice.sample(now, now - start);
      if (stageRef.current) stageRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
      bits.update(now, Math.min(64, now - last) / 1000);
      last = now;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [juice, bits]);
  /** He turns up while you are choosing, and stands a little closer as you dither. */
  useEffect(() => {
    if (phase !== "menu" && phase !== "amount" && phase !== "pin") return;
    const t = window.setTimeout(() => {
      if (queueRef.current) {
        queueRef.current.style.display = "";
        queueRef.current.style.transform = "translateX(-6px)";
      }
    }, 4200);
    return () => window.clearTimeout(t);
  }, [phase]);
  /** the fifties-only mood strikes on odd minutes, like everything municipal */
  const fiftiesOnly = useRef(new Date().getMinutes() % 2 === 1).current;
  const timers = useRef<number[]>([]);
  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(
    () => () => {
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );

  const press = useCallback((key: string) => {
    setPressedKey(key);
    playSfx("click");
    window.setTimeout(() => setPressedKey(null), 130);
  }, []);

  /* ------------------------------------------------------------ input --- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") return; // the overlay contract owns Escape
      e.stopPropagation();
      const digit = e.code.startsWith("Digit")
        ? e.code.slice(5)
        : e.code.startsWith("Numpad") && /\d/.test(e.code.slice(6))
          ? e.code.slice(6)
          : null;

      if (phase === "idle" && (e.code === "KeyE" || e.code === "Enter" || e.code === "Space")) {
        press("card");
        playSfx("register");
        setPhase("connecting");
        setNote(null);
        after(400, () => setNote("TRWA ŁĄCZENIE."));
        after(1300, () => setNote("TRWA ŁĄCZENIE.."));
        after(2200, () => setNote("TRWA ŁĄCZENIE..."));
        after(3000, () => {
          setNote(null);
          setPhase("pin");
        });
        return;
      }
      if (phase === "pin") {
        if (digit && pin.length < 4) {
          press(digit);
          const next = pin + digit;
          setPin(next);
          if (next.length === 4) {
            after(450, () => {
              playSfx("chime");
              setPhase("menu");
              setCursor(0);
            });
          }
          return;
        }
        if (e.code === "Backspace" && pin.length > 0) {
          press("<");
          setPin(pin.slice(0, -1));
        }
        return;
      }
      if (phase === "menu" || phase === "amount") {
        const items = phase === "menu" ? MENU.length : AMOUNTS.length + 1;
        if (e.code === "ArrowDown" || e.code === "KeyS") {
          press("v");
          setCursor((c) => (c + 1) % items);
        } else if (e.code === "ArrowUp" || e.code === "KeyW") {
          press("^");
          setCursor((c) => (c + items - 1) % items);
        } else if (e.code === "KeyE" || e.code === "Enter") {
          press("ok");
          if (phase === "menu") {
            if (cursor === 0) {
              setPhase("amount");
              setCursor(0);
            } else if (cursor === 1) {
              setPhase("balance");
              after(2600, () => {
                setPhase("menu");
                setCursor(0);
              });
            } else {
              eject();
            }
          } else {
            if (cursor === AMOUNTS.length) {
              setPhase("menu");
              setCursor(0);
              return;
            }
            const want = AMOUNTS[cursor];
            if (fiftiesOnly && want !== 50) {
              playSfx("denied");
              setNote("TYLKO BANKNOTY 50 ZŁ.");
              after(2200, () => setNote(null));
              return;
            }
            if (want > account) {
              playSfx("denied");
              setNote("ŚRODKI NIEWYSTARCZAJĄCE.");
              after(2200, () => setNote(null));
              return;
            }
            setPhase("counting");
            setNote("LICZENIE BANKNOTÓW.");
            after(700, () => playSfx("coins"));
            after(1200, () => setNote("LICZENIE BANKNOTÓW.."));
            after(1500, () => playSfx("coins"));
            after(2200, () => {
              setNote(null);
              setCash(want);
              setPhase("cash");
              playSfx("register");
              juice.shake(1, 140);
              for (let k = 0; k < 6; k++) {
                bits.spawn({
                  x: 106 + k * 3,
                  y: 148,
                  vx: -14 + k * 6,
                  vy: -20 - k * 3,
                  life: 520,
                  color: k % 2 ? "#e8c445" : "#c9a24b",
                  size: 1,
                  gravity: 130,
                });
              }
            });
          }
        }
        return;
      }
      if (phase === "cash" && (e.code === "KeyE" || e.code === "Enter")) {
        press("ok");
        playSfx("coins");
        onWithdraw(cash);
        setCash(0);
        eject();
      }
    };
    const eject = () => {
      setPhase("eject");
      setNote("KARTA. PARAGON W CENIE.");
      setVerdict(
        queueRef.current?.style.display === ""
          ? "Karta w kieszeni. Pan za tobą nic nie powiedział, i to było najgorsze."
          : "Karta w kieszeni. Nikt nie patrzył. Dobry wieczór.",
      );
      after(500, () => playSfx("register"));
      after(2400, onClose);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    phase,
    pin,
    cursor,
    cash,
    account,
    fiftiesOnly,
    onWithdraw,
    onClose,
    press,
    after,
    juice,
    bits,
  ]);

  /* ------------------------------------------------------------ screen --- */
  const screenLines = (): { text: string; dim?: boolean }[] => {
    switch (phase) {
      case "idle":
        return [
          { text: "BANK SPOLDZIELCZY" },
          { text: "ODDZIAL 16", dim: true },
          { text: `W KIESZENI ${money} ZL`, dim: true },
          { text: "WLOZ KARTE  [E]" },
        ];
      case "connecting":
        return [{ text: "PROSZE CZEKAC" }, { text: note ?? "", dim: true }];
      case "pin":
        return [
          { text: "PODAJ PIN" },
          { text: "*".repeat(pin.length) + "_".repeat(4 - pin.length) },
          { text: "" },
          { text: "KLAWIATURA 0-9", dim: true },
        ];
      case "menu":
        return [
          { text: "WYBIERZ OPERACJE" },
          ...MENU.map((m, i) => ({ text: `${i === cursor ? ">" : " "} ${m}` })),
        ];
      case "amount":
        return [
          { text: "KWOTA WYPLATY" },
          ...AMOUNTS.map((a, i) => ({ text: `${i === cursor ? ">" : " "} ${a} ZL` })),
          { text: `${cursor === AMOUNTS.length ? ">" : " "} POWROT`, dim: true },
        ];
      case "counting":
        return [{ text: "PROSZE CZEKAC" }, { text: note ?? "", dim: true }];
      case "cash":
        return [
          { text: "ODBIERZ GOTOWKE" },
          { text: `${cash} ZL  [E]` },
          { text: "" },
          { text: "NIE LICZ PRZY LUDZIACH", dim: true },
        ];
      case "balance":
        return [
          { text: "STAN KONTA" },
          { text: `${account} ZL` },
          { text: "" },
          { text: "WYSTARCZY.", dim: true },
        ];
      case "eject":
        return [{ text: "DZIEKUJEMY" }, { text: note ?? "", dim: true }];
    }
  };
  const err = note && (phase === "menu" || phase === "amount");

  /* the keypad, drawn as twelve individually raised keys */
  const keyRects: { key: string; r: Rect }[] = [];
  const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "<", "0", "ok"];
  KEYPAD.forEach((k, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    keyRects.push({
      key: k,
      r: [KEYS_X + col * (KEY_W + KEY_GAP), KEYS_Y + row * (KEY_H + KEY_GAP), KEY_W, KEY_H],
    });
  });

  const glow = tiers(
    (s) => steppedEllipse(120, 52, Math.round(58 * s), Math.round(30 * s), 3),
    "e",
    0.8,
  );

  return (
    <MinigameShell
      w={W}
      h={H}
      bg="#0a0c10"
      stageRef={stageRef}
      verdict={verdict}
      hint={
        phase === "eject"
          ? ""
          : phase === "idle"
            ? "[e] вкласти картку · esc відійти"
            : "цифри · w s вибір · e підтвердити · esc забрати картку"
      }
      maxWidth="max-w-2xl"
    >
      {/* the wall behind: night render, dithered */}
      <rect width={W} height={KERB_Y} fill="#1c1a17" />
      {/* the render's courses, and the damp rising up from the kerb */}
      {[26, 58, 90, 122, 154].map((y) => (
        <rect key={y} x={0} y={y} width={W} height={1} fill="#161410" opacity={0.8} />
      ))}
      <path d={pxPath([[0, 146, W, 16]])} fill="#141210" opacity={0.7} />
      {/* the pavement, its kerb, and the puddle that never dries on this block */}
      <rect x={0} y={KERB_Y} width={W} height={H - KERB_Y} fill="#1a1a1e" />
      <rect x={0} y={KERB_Y} width={W} height={2} fill="#26262c" />
      <rect x={0} y={KERB_Y + 2} width={W} height={1} fill="#0e0e12" />
      {[46, 118, 196, 268].map((x) => (
        <rect key={x} x={x} y={KERB_Y + 3} width={1} height={H - KERB_Y - 3} fill="#121216" />
      ))}
      <path d={pxPath(steppedEllipse(196, 180, 26, 6, 2))} fill="#0d1418" />
      <path d={pxPath(steppedEllipse(196, 179, 20, 4, 2))} fill="#16242a" opacity={0.8} />
      <rect width={W} height={H} fill={dth("n", "25")} />
      {/* the machine's stepped shadow onto the wall — depth before detail */}
      <path
        d={pxPath([
          [BODY[0] + BODY[2], BODY[1] + 6, 5, BODY[3] - 6],
          [BODY[0] + BODY[2] + 5, BODY[1] + 14, 3, BODY[3] - 22],
          [BODY[0] + 4, BODY[1] + BODY[3], BODY[2] + 4, 4],
        ])}
        fill="#0a0c10"
        opacity={0.5}
      />
      {/* body: municipal plaster-beige, bevel edge-light on every box */}
      <rect x={BODY[0]} y={BODY[1]} width={BODY[2]} height={BODY[3]} fill={M.plaster.lo} />
      <Bev set={bevelPaths([BODY])} mat={M.plaster} />
      {/* night takes most of the fascia back; only the screen keeps any of it */}
      <rect
        x={BODY[0]}
        y={BODY[1]}
        width={BODY[2]}
        height={BODY[3]}
        fill="#0a0b0f"
        opacity={0.62}
      />
      <rect x={BODY[0]} y={BODY[1]} width={BODY[2]} height={BODY[3]} fill={dth("n", "25")} />
      {/* side shading: the right face falls away */}
      <rect x={BODY[0] + BODY[2] - 6} y={BODY[1]} width={6} height={BODY[3]} fill={M.plaster.lo} />
      <rect
        x={BODY[0] + BODY[2] - 2}
        y={BODY[1]}
        width={2}
        height={BODY[3]}
        fill={M.plaster.deep}
      />

      {/* bank strip */}
      <rect x={BODY[0]} y={BODY[1] + 2} width={BODY[2]} height={9} fill={M.teal.base} />
      <rect x={BODY[0]} y={BODY[1] + 2} width={BODY[2]} height={1} fill={M.teal.hi} />
      <PixelText x={BODY[0] + 8} y={BODY[1] + 4} text="BANKOMAT" fill={M.linen.hi} />

      {/* screen: recessed graphite bezel, then the tube */}
      <rect
        x={SCREEN_BEZEL[0]}
        y={SCREEN_BEZEL[1]}
        width={SCREEN_BEZEL[2]}
        height={SCREEN_BEZEL[3]}
        fill={M.graphite.base}
      />
      <Bev set={bevelPaths([SCREEN_BEZEL])} mat={M.graphite} />
      {/* recess: dark on top/left inside the bezel — carved IN, not raised */}
      <path
        d={pxPath([
          [SCREEN[0] - 1, SCREEN[1] - 1, SCREEN[2] + 2, 1],
          [SCREEN[0] - 1, SCREEN[1], 1, SCREEN[3] + 1],
        ])}
        fill="#101215"
      />
      <rect x={SCREEN[0]} y={SCREEN[1]} width={SCREEN[2]} height={SCREEN[3]} fill={SCREEN_BG} />
      {/* the green glow pooling out of the recess onto the fascia */}
      <Light set={glow} op={phase === "idle" ? 0.5 : 0.8} />
      {/* screen text */}
      {screenLines().map((l, i) =>
        l.text ? (
          <PixelText
            // biome-ignore lint/suspicious/noArrayIndexKey: screen rows are positional slots
            key={`${phase}:${i}:${l.text}`}
            x={SCREEN[0] + 4}
            y={SCREEN[1] + 5 + i * 9}
            text={l.text}
            fill={l.dim ? GREEN_DIM : GREEN}
          />
        ) : null,
      )}
      {err ? (
        <PixelText
          x={SCREEN[0] + 4}
          y={SCREEN[1] + SCREEN[3] - 9}
          text={note ?? ""}
          fill="#d88f5a"
        />
      ) : null}
      {/* scanlines + tube vignette */}
      <rect
        x={SCREEN[0]}
        y={SCREEN[1]}
        width={SCREEN[2]}
        height={SCREEN[3]}
        fill={dth("n", "12")}
      />

      {/* keypad: every key its own raised box; the pressed one drops */}
      {keyRects.map(({ key, r }) => {
        const down = pressedKey === key;
        const [x, y, w, h] = r;
        return (
          <g key={key} transform={down ? "translate(0 1)" : undefined}>
            <rect x={x} y={y + h} width={w} height={down ? 1 : 2} fill={M.steel.deep} />
            <rect x={x} y={y} width={w} height={h} fill={down ? M.steel.lo : M.steel.base} />
            <rect x={x} y={y} width={w} height={1} fill={M.steel.hi} />
            <rect x={x} y={y} width={1} height={h} fill={M.steel.hi} opacity={0.7} />
            <PixelText
              x={x + Math.floor((w - textWidth(key === "ok" ? "OK" : key, 1)) / 2)}
              y={y + 2}
              text={key === "ok" ? "OK" : key === "<" ? "C" : key}
              fill={M.graphite.deep}
            />
          </g>
        );
      })}
      <AO x={KEYS_X - 2} y={KEYS_Y + 4 * (KEY_H + KEY_GAP)} w={3 * (KEY_W + KEY_GAP)} op={0.5} />

      {/* card slot: lit green when waiting, amber while held */}
      <rect
        x={CARD_SLOT[0]}
        y={CARD_SLOT[1]}
        width={CARD_SLOT[2]}
        height={CARD_SLOT[3]}
        fill={M.graphite.base}
      />
      <Bev set={bevelPaths([CARD_SLOT])} mat={M.graphite} />
      <rect
        x={CARD_SLOT[0] + 4}
        y={CARD_SLOT[1] + 3}
        width={CARD_SLOT[2] - 8}
        height={2}
        fill="#08090b"
      />
      <rect
        x={CARD_SLOT[0] + CARD_SLOT[2] - 7}
        y={CARD_SLOT[1] - 4}
        width={4}
        height={3}
        fill={phase === "idle" || phase === "eject" ? "#71d871" : "#d8a24a"}
      >
        <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
      </rect>
      <PixelText x={CARD_SLOT[0]} y={CARD_SLOT[1] + 11} text="KARTA" fill={M.plaster.deep} />

      {/* cash slot with shutter; bills emerge in `cash` phase */}
      <rect
        x={CASH_SLOT[0]}
        y={CASH_SLOT[1]}
        width={CASH_SLOT[2]}
        height={CASH_SLOT[3]}
        fill={M.graphite.base}
      />
      <Bev set={bevelPaths([CASH_SLOT])} mat={M.graphite} />
      <rect
        x={CASH_SLOT[0] + 4}
        y={CASH_SLOT[1] + 4}
        width={CASH_SLOT[2] - 8}
        height={3}
        fill="#08090b"
      />
      {phase === "cash" ? (
        <g>
          {/* the note sticking out: enamel-green PLN with a lighter band */}
          <rect x={CASH_SLOT[0] + 14} y={CASH_SLOT[1] - 6} width={60} height={8} fill="#7a9a62" />
          <rect x={CASH_SLOT[0] + 14} y={CASH_SLOT[1] - 6} width={60} height={1} fill="#a4bd8c" />
          <rect x={CASH_SLOT[0] + 38} y={CASH_SLOT[1] - 5} width={12} height={7} fill="#8fae76" />
          <PixelText x={CASH_SLOT[0] + 18} y={CASH_SLOT[1] - 4} text={`${cash}`} fill="#2c3f2e" />
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 4; 0 0"
            dur="0.4s"
            fill="freeze"
          />
        </g>
      ) : null}
      <PixelText x={CASH_SLOT[0]} y={CASH_SLOT[1] + 12} text="WYPLATA" fill={M.plaster.deep} />

      {/* the queue: one man, behind you, who is not in a hurry but is waiting */}
      <g ref={queueRef} style={{ display: "none", transition: "transform 300ms steps(3, end)" }}>
        {/* his shadow first, so he stands on the pavement rather than over it */}
        <path
          d={pxPath([
            [234, 176, 40, 3],
            [240, 179, 28, 2],
          ])}
          fill="#050608"
          opacity={0.6}
        />
        <path d={pxPath([[246, 96, 14, 11]])} fill="#6d5641" />
        <path d={pxPath([[246, 96, 14, 3]])} fill="#3a2e24" />
        <rect x={249} y={101} width={2} height={2} fill="#12100c" />
        <rect x={255} y={101} width={2} height={2} fill="#12100c" />
        <path
          d={pxPath([
            [240, 107, 26, 40],
            [237, 112, 32, 30],
          ])}
          fill="#2b2f38"
        />
        <path d={pxPath([[240, 107, 26, 2]])} fill="#3c4250" />
        <path
          d={pxPath([
            [242, 147, 10, 28],
            [256, 147, 10, 28],
          ])}
          fill="#1b2230"
        />
        <rect x={240} y={173} width={13} height={3} fill="#14171d" />
        <rect x={255} y={173} width={13} height={3} fill="#14171d" />
        {/* the bag he is holding, and the cigarette he is not smoking indoors */}
        <path d={pxPath([[268, 126, 10, 14]])} fill="#3d2f1c" />
        <path d={pxPath([[268, 126, 10, 1]])} fill="#5a4526" />
        <rect x={234} y={124} width={4} height={1} fill="#d8d3c5" opacity={0.7} />
        <rect x={233} y={124} width={1} height={1} fill="#e8863c" />
      </g>

      {/* the coins and receipt bits the machine throws when it finally pays */}
      <g>{bits.nodes}</g>
    </MinigameShell>
  );
}
