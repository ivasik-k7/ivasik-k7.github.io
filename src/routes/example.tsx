import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

/**
 * /example — the engine's minimal example game (see game/example/ExampleGame).
 * Lazy, so the real game's boot never pays for it.
 */
const ExampleGame = lazy(() =>
  import("@/game/example/ExampleGame").then((m) => ({ default: m.ExampleGame })),
);

export const Route = createFileRoute("/example")({
  component: () => (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <ExampleGame />
    </Suspense>
  ),
});
