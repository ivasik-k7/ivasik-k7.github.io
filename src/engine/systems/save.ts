/**
 * Save system — versioned localStorage snapshots.
 * A bumped version invalidates old saves instead of loading garbage.
 */

export interface SaveSlot<W> {
  version: number;
  world: W;
  scene: string;
  x: number;
  savedAt: string;
}

export function saveGame<W>(key: string, slot: SaveSlot<W>): void {
  try {
    localStorage.setItem(key, JSON.stringify(slot));
  } catch {
    // storage full / private mode — saving is best-effort
  }
}

export function loadGame<W>(key: string, version: number): SaveSlot<W> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const slot = JSON.parse(raw) as SaveSlot<W>;
    if (slot.version !== version) return null;
    return slot;
  } catch {
    return null;
  }
}

export function clearSave(key: string): void {
  localStorage.removeItem(key);
}
