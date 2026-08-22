import { useEffect, useMemo, useRef, useState } from "react";
import { mumble, voiceFor } from "../audio/voice";
import { fontCovers } from "../scene/pixelKit";
import {
  type DialogueMood,
  type DialogueState,
  dialogueAtChoices,
  offeredChoices,
} from "../systems/dialogue";
import { PixelFrame, PixelLabel } from "./PixelFrame";
import { PixelProse } from "./PixelProse";
import { SpeechText } from "./SpeechPanel";
import { PARCHMENT, prose, SIGNAL } from "./uiLook";

/**
 * A conversation, on the HUD's own plate.
 *
 * This is the third dress this box has worn, and the wheel has come round on
 * purpose: it started as a riveted `PixelFrame`, was stripped back to bare
 * type on a gradient when the frame felt heavier than the words, and is now a
 * `PixelFrame` again — because the words themselves changed. They are set in
 * `PixelProse`, the interface's 3×5 glyph font one step smaller than the
 * HUD's labels, and pixel type on a pixel plate reads as one manufactured
 * object where web type on that plate read as a browser in a picture frame.
 * The clock, the interact chip and the conversation are now literally the
 * same material.
 *
 * The speaker rides the panel's title tab in the mood's accent; choices are a
 * column with the menu's fixed-width arrow; the hints are spelled in the same
 * glyphs along the bottom. Input is owned by the runtime; this renders and
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
  // the lines resolved for THIS visit — variants and line-conditions applied
  const line = state.lines[state.lineIndex];
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

  /** prose one step under the HUD's px=3 labels — "same font, smaller" */
  const px = Math.max(2, u - 1);
  const lineH = 8 * px;

  return (
    <div
      className="absolute right-0 bottom-0 left-0 z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative mx-auto w-full max-w-2xl px-[7%] pb-4 [@media(pointer:coarse)]:pb-20">
        <PixelFrame
          u={u}
          tone="panel"
          title={
            line.speaker ? (
              <PixelLabel text={line.speaker.toUpperCase()} px={px} fill={accent} opacity={0.95} />
            ) : undefined
          }
          bodyStyle={{ padding: `${u * 4}px ${u * 4}px ${u * 3}px` }}
        >
          <div
            style={{
              minHeight: lineH * 2 + px,
              // the player's own head: dimmer, plateless, set off by a thin rule
              ...(line.voice === "inner"
                ? { borderLeft: "2px solid rgba(227,217,194,0.28)", paddingLeft: u * 3 }
                : null),
            }}
          >
            {fontCovers(line.text) ? (
              <PixelProse
                key={`${state.nodeId}:${state.lineIndex}`}
                text={line.text}
                px={px}
                fill={PARCHMENT}
                opacity={line.voice === "inner" ? 0.6 : 0.92}
                done={state.lineDone}
                caret
                onDone={() => setTyped(true)}
              />
            ) : (
              /* the 3×5 face has no glyphs for this line (Ukrainian, French
                 cedillas) — the words matter more than the material, so this
                 line alone falls back to the prose face, verbatim */
              <p
                style={{
                  ...prose(Math.max(12, px * 4)),
                  color: PARCHMENT,
                  opacity: line.voice === "inner" ? 0.6 : 0.92,
                }}
              >
                <SpeechText
                  key={`${state.nodeId}:${state.lineIndex}`}
                  text={line.text}
                  done={state.lineDone}
                  u={u}
                  fontSize={Math.max(12, px * 4)}
                  onDone={() => setTyped(true)}
                />
              </p>
            )}
          </div>

          {atChoices ? (
            <ul className="mt-2 flex flex-col" style={{ gap: u }}>
              {choices.map((choice, i) => {
                const locked = choice.lockedBy !== null;
                const seen = choice.seenBefore && !locked;
                const here = i === state.choiceIndex;
                const fill = locked
                  ? "rgba(227,217,194,0.34)"
                  : here
                    ? accent
                    : seen
                      ? "rgba(227,217,194,0.44)" // already asked — dimmer, still there
                      : "rgba(227,217,194,0.66)";
                return (
                  <li key={choice.id ?? choice.label}>
                    <button
                      type="button"
                      disabled={locked}
                      aria-current={here}
                      className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
                      onClick={() => {
                        if (!locked) onChoose(i);
                      }}
                    >
                      {/* the marker column is a fixed width, so choosing does not
                          shift the labels — the same rule the menu follows */}
                      <Mark on={here && !locked} u={u} colour={accent} />
                      <span className="flex-1">
                        {fontCovers(choice.label) ? (
                          <PixelProse text={choice.label} px={px} fill={fill} done />
                        ) : (
                          <span style={{ ...prose(Math.max(11, px * 3.6)), color: fill }}>
                            {choice.label}
                          </span>
                        )}
                      </span>
                      {/* a gate says what it wants rather than just refusing */}
                      {locked ? (
                        fontCovers(choice.lockedBy ?? "") ? (
                          <PixelProse
                            text={choice.lockedBy ?? ""}
                            px={px}
                            fill={PARCHMENT}
                            opacity={0.4}
                            done
                          />
                        ) : (
                          <span
                            style={{
                              ...prose(Math.max(11, px * 3.6)),
                              color: PARCHMENT,
                              opacity: 0.4,
                            }}
                          >
                            {choice.lockedBy}
                          </span>
                        )
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {/* the controls, spelled in the same glyphs, quiet along the bottom */}
          <button
            type="button"
            onClick={atChoices ? undefined : onAdvance}
            className="mt-3 block text-left"
            aria-label={atChoices ? "choose a reply" : settled ? "continue" : "reveal the rest"}
          >
            <PixelLabel
              text={atChoices ? "UP/DOWN PICK · E CHOOSE" : settled ? "E CONTINUE" : "E SKIP"}
              px={px}
              fill={PARCHMENT}
              opacity={0.38}
            />
          </button>
        </PixelFrame>
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
