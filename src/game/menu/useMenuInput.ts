import { useEffect, useRef } from "react";

/**
 * The menu's input layer — keyboard, WASD and gamepad, in one place.
 *
 * The game has to be completely playable without a mouse, and the first
 * version of the menu was only half that: the title screen took arrows and
 * Enter, and the two screens behind it took nothing at all. You could arrow
 * down to SETTINGS, press Enter, and then find no cursor, no way to select a
 * row and no way to change a value — a controller player could enter that
 * screen and only leave it again. Every screen now uses this hook, so they all
 * navigate identically and none of them can be built without input by
 * accident.
 *
 * Four axes and two verbs, and every one of them has a key, a letter and a pad
 * binding:
 *
 *   up / down      ArrowUp ArrowDown   W S   dpad ↑↓   left stick Y
 *   left / right   ArrowLeft ArrowRight A D  dpad ←→   left stick X
 *   confirm        Enter Space E             A / cross
 *   cancel         Escape Backspace Q        B / circle
 *
 * Directions repeat when held, after a pause, at a steady rate — dragging a
 * volume from silent to full is ten presses otherwise. The verbs never repeat,
 * because holding Enter should not open a screen eight times.
 */

/** Wait this long before a held direction starts repeating, then this often. */
const REPEAT_DELAY_MS = 380;
const REPEAT_RATE_MS = 90;

/** How far a stick has to move before it counts as a direction. */
const DEADZONE = 0.55;

export type MenuInputHandlers = {
  /** dy: -1 up, +1 down */
  onVertical?: (dy: -1 | 1) => void;
  /** dx: -1 left, +1 right */
  onHorizontal?: (dx: -1 | 1) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** any input at all, before the specific handler — used to unlock audio */
  onAny?: () => void;
};

const VERTICAL: Record<string, -1 | 1> = {
  ArrowUp: -1,
  KeyW: -1,
  ArrowDown: 1,
  KeyS: 1,
};
const HORIZONTAL: Record<string, -1 | 1> = {
  ArrowLeft: -1,
  KeyA: -1,
  ArrowRight: 1,
  KeyD: 1,
};
const CONFIRM = new Set(["Enter", "Space", "KeyE", "NumpadEnter"]);
const CANCEL = new Set(["Escape", "Backspace", "KeyQ"]);

/**
 * `code` rather than `key`, so W/A/S/D work on a layout where those letters sit
 * elsewhere — on AZERTY the physical W key reports "z". A player using WASD is
 * using the shape of the keys, not the letters printed on them.
 */
export function useMenuInput(enabled: boolean, handlers: MenuInputHandlers): void {
  // handlers change every render; the listeners must not
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    let repeatTimer = 0;
    const stopRepeat = () => {
      if (repeatTimer) window.clearTimeout(repeatTimer);
      repeatTimer = 0;
    };

    const fire = (code: string) => {
      const dy = VERTICAL[code];
      if (dy) {
        h.current.onVertical?.(dy);
        return true;
      }
      const dx = HORIZONTAL[code];
      if (dx) {
        h.current.onHorizontal?.(dx);
        return true;
      }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // a modifier means the player is talking to the browser, not to us
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = e.code;
      if (VERTICAL[code] || HORIZONTAL[code] || CONFIRM.has(code) || CANCEL.has(code)) {
        e.preventDefault();
      } else {
        return;
      }
      h.current.onAny?.();
      // the browser's own auto-repeat is uneven and per-OS; ours is not
      if (e.repeat) return;
      if (fire(code)) {
        stopRepeat();
        const again = () => {
          fire(code);
          repeatTimer = window.setTimeout(again, REPEAT_RATE_MS);
        };
        repeatTimer = window.setTimeout(again, REPEAT_DELAY_MS);
        return;
      }
      if (CONFIRM.has(code)) h.current.onConfirm?.();
      else if (CANCEL.has(code)) h.current.onCancel?.();
    };

    const onKeyUp = () => stopRepeat();
    // a lost window keeps no keys down
    const onBlur = () => stopRepeat();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      stopRepeat();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);

  // --- gamepad ---------------------------------------------------------------
  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== "function") return;
    let raf = 0;
    // last state per axis/button, so a held direction repeats on our clock and
    // a held button does not repeat at all
    let vy: -1 | 0 | 1 = 0;
    let vx: -1 | 0 | 1 = 0;
    let nextY = 0;
    let nextX = 0;
    let heldA = false;
    let heldB = false;

    const step = (v: number, minus: boolean, plus: boolean): -1 | 0 | 1 =>
      plus || v > DEADZONE ? 1 : minus || v < -DEADZONE ? -1 : 0;

    const poll = (now: number) => {
      const pad = navigator.getGamepads()[0];
      if (pad) {
        const y = step(
          pad.axes[1] ?? 0,
          Boolean(pad.buttons[12]?.pressed),
          Boolean(pad.buttons[13]?.pressed),
        );
        const x = step(
          pad.axes[0] ?? 0,
          Boolean(pad.buttons[14]?.pressed),
          Boolean(pad.buttons[15]?.pressed),
        );
        if (y !== 0 && (y !== vy || now >= nextY)) {
          h.current.onAny?.();
          h.current.onVertical?.(y);
          nextY = now + (y !== vy ? REPEAT_DELAY_MS : REPEAT_RATE_MS);
        }
        if (x !== 0 && (x !== vx || now >= nextX)) {
          h.current.onAny?.();
          h.current.onHorizontal?.(x);
          nextX = now + (x !== vx ? REPEAT_DELAY_MS : REPEAT_RATE_MS);
        }
        vy = y;
        vx = x;
        const a = Boolean(pad.buttons[0]?.pressed);
        const b = Boolean(pad.buttons[1]?.pressed);
        if (a && !heldA) {
          h.current.onAny?.();
          h.current.onConfirm?.();
        }
        if (b && !heldB) {
          h.current.onAny?.();
          h.current.onCancel?.();
        }
        heldA = a;
        heldB = b;
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);
}

/**
 * Move a cursor over a list, stepping over anything unselectable.
 *
 * Returns the same index when every entry is disabled, rather than looping for
 * ever — which is the state a settings screen is in for one frame while it
 * mounts.
 */
export function stepCursor(
  from: number,
  delta: number,
  count: number,
  skip: (i: number) => boolean,
): number {
  if (count <= 0) return from;
  let next = from;
  for (let i = 0; i < count; i++) {
    next = (next + delta + count) % count;
    if (!skip(next)) return next;
  }
  return from;
}
