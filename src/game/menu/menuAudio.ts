import { ambience, LOFI_TRACKS, lofiPlayer } from "@/engine";
import type { Settings } from "./settings";
import { applySettings } from "./settings";

/**
 * The title screen's sound.
 *
 * Two constraints shape all of this. The first is the browser's: an
 * AudioContext created before the player has touched anything starts
 * suspended, and nothing can be heard until a gesture resumes it. The second
 * is the game's: the menu is not a separate application with its own
 * soundtrack that stops at the door. It is the same yard, at dusk, and when
 * the player picks NEW GAME the music should still be playing on the other
 * side of the fade.
 *
 * So the menu does not own the audio — it *starts* it. The first key, click or
 * pad press unlocks the shared graph, brings up the street bed and puts the
 * dusk track on, at whatever volumes the player's settings say. From then on
 * it is the game's audio, and walking into the flat only changes the bed.
 *
 * There is no "press any key to enable sound" line. The key that enables it is
 * the same key that moves the cursor, and telling the player about a browser
 * policy is not the first thing this game should say.
 */

/**
 * The track the title screen opens on. Named rather than indexed so
 * reordering the playlist cannot silently change which one this is; if it ever
 * disappears the menu falls back to whatever is first.
 */
const MENU_TRACK = "LATE AFTERNOON";

function selectTrack(name: string): void {
  const want = LOFI_TRACKS.findIndex((t) => t.name === name);
  if (want < 0 || want === lofiPlayer.trackIndex) return;
  lofiPlayer.next(want - lofiPlayer.trackIndex);
}

let started = false;

/**
 * Bring the audio up. Safe to call repeatedly and from anywhere — only the
 * first call does anything, so every input handler can simply call it rather
 * than tracking whether the gesture has happened yet.
 */
export function startMenuAudio(settings: Settings): void {
  if (started) return;
  started = true;
  lofiPlayer.unlock();
  applySettings(settings);
  ambience.applyPending();
  // the yard: traffic a street away, wind in the gap between the blocks
  ambience.set("street");
  selectTrack(MENU_TRACK);
  if (settings.music > 0) lofiPlayer.play();
}

/**
 * Called when the player commits to a game. The music is deliberately left
 * running — the fade to black is a cut in the picture, not in the sound — but
 * the outdoor bed is dropped so the runtime can set the room's own without
 * having to crossfade out of a street it never turned on.
 */
export function handOffMenuAudio(): void {
  ambience.set("none");
}

/** Test seam: forget that audio was started. */
export function resetMenuAudio(): void {
  started = false;
}
