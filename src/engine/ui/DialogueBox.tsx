import { useEffect, useState } from "react";
import { mumble, voiceFor } from "../audio/voice";
import type { DialogueChoice } from "../systems/dialogue";
import { type DialogueState, dialogueAtChoices } from "../systems/dialogue";

/**
 * Bottom dialogue panel: speaker tag, typewriter text, choice list.
 * Input (advance / choose) is owned by the runtime; this only renders.
 */
export function DialogueBox({
  state,
  onAdvance,
  onChoose,
}: {
  state: DialogueState;
  onAdvance: () => void;
  onChoose: (index: number) => void;
}) {
  const node = state.tree.nodes[state.nodeId];
  const line = node.lines[state.lineIndex];
  const atChoices = dialogueAtChoices(state);
  const [shown, setShown] = useState(0);

  // spoken lines mumble in their speaker's voice as they type out
  useEffect(() => {
    if (line.speaker && !state.lineDone) {
      mumble(line.text, voiceFor(line.speaker));
    }
  }, [line, state.lineDone]);

  // typewriter: ~55 chars/s; a finished line renders in full
  useEffect(() => {
    if (state.lineDone) {
      setShown(line.text.length);
      return;
    }
    setShown(0);
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= line.text.length) window.clearInterval(timer);
        return n + 1;
      });
    }, 18);
    return () => window.clearInterval(timer);
  }, [line, state.lineDone]);

  return (
    <button
      type="button"
      className="absolute right-0 bottom-0 left-0 z-30 cursor-default text-left"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      onClick={onAdvance}
    >
      <div className="mx-auto max-w-2xl border border-parchment/25 bg-black/90 px-5 py-4 font-mono">
        {line.speaker ? (
          <p className="mb-1 text-signal text-xs tracking-[0.3em]">{line.speaker.toUpperCase()}</p>
        ) : null}
        <p className="min-h-[2.5rem] text-parchment text-sm leading-relaxed">
          {line.text.slice(0, shown)}
          {shown < line.text.length ? <span className="animate-pulse">▎</span> : null}
        </p>
        {atChoices ? (
          <div className="mt-3 flex flex-col gap-1">
            {(node.choices as DialogueChoice<never>[]).map((choice, i) => (
              <button
                key={choice.label}
                type="button"
                className={`text-left text-sm tracking-wide ${
                  i === state.choiceIndex ? "text-signal" : "text-parchment/60"
                } hover:text-signal`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChoose(i);
                }}
              >
                {i === state.choiceIndex ? "▸ " : "  "}
                {choice.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-right text-parchment/40 text-xs">[E] ▾</p>
        )}
      </div>
    </button>
  );
}
