import { useEffect, useMemo, useRef, useState } from "react";
import { mumble, voiceFor } from "../audio/voice";
import {
  type DialogueMood,
  type DialogueState,
  dialogueAtChoices,
  offeredChoices,
} from "../systems/dialogue";
import { PixelLabel } from "./PixelFrame";
import { SpeechText } from "./SpeechPanel";
import { PARCHMENT, prose, proseQuiet, RULE, SIGNAL } from "./uiLook";

/**
 * A conversation.
 *
 * Set the way the title screen is set, because the title screen is the most
 * legible surface in the game and the reason is that there is nothing on it:
 * the speaker's name in the 3×5 pixel font with a rule running off it, the line
 * in mono underneath, the choices as a column with an arrow beside the one you
 * are on. No box, no frame, no plate — the words sit on a gradient that lifts
 * the bottom of the screen just enough to read against, and the game carries on
 * being visible behind them.
 *
 * It replaces a version built out of the HUD's riveted `PixelFrame`. That was
 * consistent with the clock and the music deck and still wrong: four decorated
 * edges, a chamfer, a scanline wash and eight rivets around two lines of
 * dialogue, over pixel art that is already dense. The frame won and the words
 * lost.
 *
 * Everything is on one left edge — the same 7% gutter the menu uses — so the
 * name, the line, the choices and the hint form a single column, and nothing
 * moves when the cursor does. Input is owned by the runtime; this renders and
 * forwards clicks.
 */

/**
 * The accent, by mood. Selection is normally the one yellow in the game, and a
 * conversation is the one place that is worth bending: a tense line and a warm
 * line should not point at their choices in the same colour.
 */
const MOOD_ACCENT: Record<DialogueMood, string> = {
  neutral: SIGNAL,
  warm: "#f0b45e",
  tense: "#e0714a",
  sad: "#7fa8cc",
  amused: "#b9d06a",
};

export function DialogueBox({
  state,
  makeCtx,
  onAdvance,
  onChoose,
  u = 3,
}: {
  state: DialogueState;
  /** for evaluating `when` / `locked` against the live world */
  makeCtx: () => unknown;
  onAdvance: () => void;
  onChoose: (index: number) => void;
  u?: number;
}) {
  const node = state.tree.nodes[state.nodeId];
  const line = node?.lines[state.lineIndex];
  const choices = useMemo(() => (node ? offeredChoices(node, makeCtx) : []), [node, makeCtx]);
  const atChoices = dialogueAtChoices(state, makeCtx);
  const accent = MOOD_ACCENT[line?.mood ?? "neutral"];
  const spoken = useRef<string | null>(null);
  /**
   * The typewriter finishing and the player pressing on are different events.
   * `lineDone` only flips on input, so a line that had already typed itself out
   * still offered to SKIP something that was fully on screen.
   */
  const [typed, setTyped] = useState(false);
  const settled = state.lineDone || typed;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a reset keyed on the line, not a read of it
  useEffect(() => {
    setTyped(false);
  }, [state.nodeId, state.lineIndex]);

  // Spoken lines mumble in their speaker's voice as they type. Keyed on the
  // text rather than on the line object so that flipping `lineDone` — which
  // happens on the very next keypress — does not fire the voice a second time.
  useEffect(() => {
    if (!line?.speaker || state.lineDone) return;
    if (spoken.current === line.text) return;
    spoken.current = line.text;
    mumble(line.text, voiceFor(line.speaker));
  }, [line, state.lineDone]);

  if (!line) return null;

  const font = Math.max(12, u * 4);
  const label = Math.max(2, u - 1);

  return (
    <div
      className="absolute right-0 bottom-0 left-0 z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* The ground. A gradient rather than a panel: the scene keeps showing
          through the top of it, which is what stops a conversation feeling like
          a screen that has replaced the game. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0"
        style={{
          height: `calc(100% + ${u * 20}px)`,
          background:
            "linear-gradient(180deg, rgba(6,8,13,0) 0%, rgba(6,8,13,0.72) 42%, rgba(6,8,13,0.92) 100%)",
        }}
      />

      <div
        className="relative mx-auto w-full max-w-2xl px-[7%] pb-5 [@media(pointer:coarse)]:pb-20"
        style={{ paddingTop: u * 6 }}
      >
        {/* the speaker, and the rule that runs off the name */}
        {line.speaker ? (
          <div className="flex items-center gap-2" style={{ marginBottom: u * 1.5 }}>
            <PixelLabel text={line.speaker.toUpperCase()} px={label} fill={accent} opacity={0.92} />
            <span style={{ flex: 1, height: 2, background: RULE }} />
          </div>
        ) : null}

        <p style={{ ...prose(font), minHeight: font * 2.6, color: "rgba(227,217,194,0.9)" }}>
          <SpeechText
            key={`${state.nodeId}:${state.lineIndex}`}
            text={line.text}
            done={state.lineDone}
            u={u}
            fontSize={font}
            onDone={() => setTyped(true)}
          />
        </p>

        {atChoices ? (
          <ul className="mt-3 flex flex-col" style={{ gap: u }}>
            {choices.map((choice, i) => {
              const locked = choice.lockedBy !== null;
              const here = i === state.choiceIndex;
              return (
                <li key={choice.id ?? choice.label}>
                  <button
                    type="button"
                    disabled={locked}
                    aria-current={here}
                    className="flex w-full items-baseline gap-3 text-left disabled:cursor-not-allowed"
                    style={{
                      ...prose(font),
                      color: locked
                        ? "rgba(227,217,194,0.34)"
                        : here
                          ? accent
                          : "rgba(227,217,194,0.66)",
                      transition: "color 140ms",
                    }}
                    onClick={() => {
                      if (!locked) onChoose(i);
                    }}
                  >
                    {/* the marker column is a fixed width, so choosing does not
                        shift the labels — the same rule the menu follows */}
                    <Mark on={here && !locked} u={u} colour={accent} />
                    <span className="flex-1">{choice.label}</span>
                    {/* a gate says what it wants rather than just refusing */}
                    {locked ? <span style={proseQuiet(font - 1)}>{choice.lockedBy}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* the controls, spelled out along the bottom the way the menu does it */}
        <button
          type="button"
          onClick={atChoices ? undefined : onAdvance}
          className="mt-3 block text-left"
          style={proseQuiet(Math.max(10, font - 2))}
          aria-label={atChoices ? "choose a reply" : settled ? "continue" : "reveal the rest"}
        >
          {atChoices ? "↑↓ pick · e choose" : settled ? "e continue" : "e skip"}
        </button>
      </div>
    </div>
  );
}

/**
 * The cursor: an arrow on the pixel grid, the same one the menu uses, in a
 * fixed-width box so the labels never move.
 */
const ARROW = "M0,0 H1 V1 H2 V2 H3 V3 H2 V4 H1 V5 H0 Z";

function Mark({ on, u, colour }: { on: boolean; u: number; colour: string }) {
  const k = Math.max(2, u - 1);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 justify-start"
      style={{ width: k * 5, paddingTop: k }}
    >
      {on ? (
        <svg
          width={k * 3}
          height={k * 5}
          viewBox="0 0 3 5"
          shapeRendering="crispEdges"
          role="presentation"
          style={{ display: "block" }}
        >
          <path d={ARROW} fill={colour} />
        </svg>
      ) : (
        <span
          style={{ width: k, height: k, marginTop: k * 2, background: PARCHMENT, opacity: 0.2 }}
        />
      )}
    </span>
  );
}
