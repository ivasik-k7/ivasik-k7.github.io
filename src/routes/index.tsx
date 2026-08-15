import { createFileRoute } from "@tanstack/react-router";
import { ApartmentGame } from "@/components/game/ApartmentGame";

export const Route = createFileRoute("/")({
  component: ApartmentGame,
});
