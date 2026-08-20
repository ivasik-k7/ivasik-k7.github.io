import { useCallback, useState } from "react";
import { clearSave } from "@/engine";
import { EngineGame } from "@/game/apartment/EngineGame";
import { MainMenu, type MenuAction } from "./MainMenu";
import { SAVE_KEY } from "./saveSummary";

/**
 * The entry flow: title screen, then the game.
 *
 * Kept as its own component rather than folded into the route so that the
 * menu and the runtime never exist at the same time — the title screen holds a
 * whole street scene and two animated NPCs, and leaving it mounted behind the
 * game would be a second world running out of sight.
 *
 * There is deliberately no loading screen. The scene the player is looking at
 * on the title is the one they are about to walk into, so the fade to black is
 * the entire transition; anything else would be a screen apologising for work
 * that takes no time.
 */
export function GameEntry() {
  const [playing, setPlaying] = useState(false);

  const start = useCallback((action: MenuAction) => {
    // New Game means new: the slot goes before the runtime reads it
    if (action.kind === "new") clearSave(SAVE_KEY);
    setPlaying(true);
  }, []);

  /**
   * Leaving from the pause menu unmounts the runtime and mounts the title
   * screen again. The save is written continuously as the player moves, so
   * there is nothing to flush here — CONTINUE will be sitting there with the
   * right room and the right time on it.
   */
  const quit = useCallback(() => setPlaying(false), []);

  if (!playing) return <MainMenu onStart={start} />;
  return <EngineGame onQuit={quit} />;
}
