import { createFileRoute } from "@tanstack/react-router";
import { GameEntry } from "@/game/menu/GameEntry";

export const Route = createFileRoute("/")({
  component: GameEntry,
});
