import { type ReactNode, useEffect } from "react";
import { PixelLabel } from "@/engine";
import { useMenuScale } from "./menuScale";
import { DIM, PARCHMENT, PROSE } from "./menuStyle";

/**
 * Shared chrome for the sub-screens, so Settings and Credits match.
 *
 * It lives in its own file because both sub-screens import it and it used to
 * live in `MainMenu`, which imports both of them — a cycle that works under
 * ESM's hoisting rules and breaks the moment one of the three gains a
 * module-scope constant, which is the sort of bug that costs an afternoon.
 *
 * Pinned rather than stacked: the heading sits under the wordmark, the way out
 * sits on the bottom margin in the same place on every screen, and the body
 * gets everything between the two to lay out however it needs. The first
 * version stacked all three up from the bottom, which worked for a list of
 * eight settings and put a 42vh credits crawl through the floor.
 */
export function MenuPanel({
  title,
  onBack,
  hint,
  children,
}: {
  title: string;
  onBack: () => void;
  /** the controls, spelled out along the bottom margin */
  hint?: string;
  children: ReactNode;
}) {
  const scale = useMenuScale();

  // Escape is handled by whichever screen owns the input, but the plate is
  // still clickable and a screen with no input hook of its own still needs a
  // way out — so this stays as the floor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <section className="absolute top-[26vh] right-[7%] bottom-[7vh] left-[7%] flex flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <PixelLabel text={title} px={scale.heading} fill={PARCHMENT} opacity={0.85} />
        <span style={{ width: 60, height: 2, background: DIM }} />
      </div>
      <div className="min-h-0 w-full flex-1">{children}</div>
      {/* Plain type, not a plate. The boxed [ESC] BACK button was the only
          framed control in the whole menu, which contradicted the one rule the
          title screen sets for itself — no boxes around the options — and read
          as a HUD widget that had wandered in. */}
      <button
        type="button"
        onClick={onBack}
        className="shrink-0 text-left transition-opacity hover:opacity-100"
        style={{ ...PROSE.quiet(scale), opacity: 0.8 }}
      >
        {hint ?? "esc  back"}
      </button>
    </section>
  );
}
