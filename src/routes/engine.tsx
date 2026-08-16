import { createFileRoute } from "@tanstack/react-router";
import { EngineGame } from "@/game/apartment/EngineGame";

export const Route = createFileRoute("/engine")({
  component: EngineGame,
});
