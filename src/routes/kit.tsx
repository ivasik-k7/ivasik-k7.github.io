import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

/**
 * /kit — the engine's primitive showcase: every helper in pixelKit, groundKit
 * and lightKit drawn once, with a phase switch. Lazy, so the game never pays
 * for it.
 */
const KitShowcase = lazy(() =>
  import("@/engine/scene/KitShowcase").then((m) => ({ default: m.KitShowcase })),
);

export const Route = createFileRoute("/kit")({
  component: () => (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <KitShowcase />
    </Suspense>
  ),
});
