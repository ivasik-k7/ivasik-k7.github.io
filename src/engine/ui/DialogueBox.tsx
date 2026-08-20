import { useEffect, useMemo, useRef, useState } from "react";
import { mumble, voiceFor } from "../audio/voice";
import {
  type DialogueMood,
  type DialogueState,
  dialogueAtChoices,
  offeredChoices,
} from "../systems/dialogue";
import { PixelLabel } from "./PixelFrame";
import { SpeechPanel, SpeechText } from "./SpeechPanel";

/**
 * The dialogue panel: speaker plate, typed line, choice list.
 *
 * Cut from the same material as the monologue bubbles (`SpeechPanel`) so that
 * a thought, a passing remark and a conversation all look like the same game
 * talking. What it adds over a bubble is hierarchy — this is the surface the
 * player reads longest and acts on, so it is wider, anchored to the bottom
 * edge, and carries the choice list.
 *
 * Input (advance / choose) is owned by the runtime; this only renders and
 * forwards clicks.
 */

const MOOD_ACCENT: Record<DialogueMood, string> = {
  neutral: "#fcee0a",
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
   * `lineDone` only flips on input, so a line that had already typed itself
   * out still offered to SKIP something that was fully on screen.
   */
  const [typed, setTyped] = useState(false);
  const settled = state.lineDone || typed;

  // Spoken lines mumble in their speaker's voice as they type. Keyed on the
  // text rather than on the line object so that flipping `lineDone` — which
  // happens on the very next keypress — does not fire the voice a second time.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a reset keyed on the line, not a read of it
  useEffect(() => {
    setTyped(false);
  }, [state.nodeId, state.lineIndex]);

  useEffect(() => {
    if (!line?.speaker || state.lineDone) return;
    if (spoken.current === line.text) return;
    spoken.current = line.text;
    mumble(line.text, voiceFor(line.speaker));
  }, [line, state.lineDone]);

  if (!line) return null;

  return (
    // The panel is a plain div and the clickable areas are buttons inside it.
    // It used to be one big <button> with the choice buttons nested inside,
    // which is invalid, unreachable by keyboard in order, and meant a click on
    // a choice also counted as an advance — the double activation that made
    // dialogue occasionally skip a line.
    <div
      className="absolute right-0 bottom-0 left-0 z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto w-full max-w-2xl px-3 pb-4 [@media(pointer:coarse)]:pb-20">
        {/* the speaker rides the title plate over the top edge, the way every
            other plate on the HUD names itself */}
        <SpeechPanel
          u={u}
          tone="say"
          align="left"
          title={line.speaker ? line.speaker.toUpperCase() : undefined}
          badge={atChoices ? "UP/DOWN" : settled ? "[E]" : undefined}
        >
          <p className="font-mono text-parchment/90" style={{ minHeight: u * 10 }}>
            <SpeechText
              key={`${state.nodeId}:${state.lineIndex}`}
              text={line.text}
              done={state.lineDone}
              u={u}
              fontSize={Math.max(11, u * 4)}
              lineHeight={Math.max(16, u * 6)}
              onDone={() => setTyped(true)}
            />
          </p>

          {atChoices ? (
            <ul className="mt-2 flex flex-col" style={{ gap: u / 2 }}>
              {choices.map((choice, i) => {
                const locked = choice.lockedBy !== null;
                const here = i === state.choiceIndex;
                return (
                  <li key={choice.id ?? choice.label}>
                    <button
                      type="button"
                      disabled={locked}
                      aria-current={here}
                      className="flex w-full items-baseline gap-2 text-left font-mono transition-colors disabled:cursor-not-allowed"
                      style={{
                        fontSize: Math.max(11, u * 4),
                        lineHeight: `${Math.max(15, u * 5)}px`,
                        color: locked
                          ? "rgba(227,217,194,0.30)"
                          : here
                            ? accent
                            : "rgba(227,217,194,0.62)",
                      }}
                      onClick={() => {
                        if (!locked) onChoose(i);
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex items-center"
                        style={{ width: u * 4, flexShrink: 0 }}
                      >
                        {here && !locked ? (
                          <PixelLabel text=">" px={Math.max(2, u - 1)} fill={accent} />
                        ) : null}
                      </span>
                      <span className="flex-1">{choice.label}</span>
                      {/* a gate says what it wants rather than just refusing */}
                      {locked ? (
                        <span style={{ color: "rgba(227,217,194,0.35)" }}>{choice.lockedBy}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <button
              type="button"
              className="mt-1 flex w-full justify-end"
              onClick={onAdvance}
              aria-label={settled ? "continue" : "reveal the rest"}
            >
              <PixelLabel
                text={settled ? "CONTINUE" : "SKIP"}
                px={Math.max(2, u - 1)}
                fill={accent}
                opacity={0.65}
              />
            </button>
          )}
        </SpeechPanel>
      </div>
    </div>
  );
}
