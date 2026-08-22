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

/** True when the write actually landed — quota and private mode say no. */
export function saveGame<W>(key: string, slot: SaveSlot<W>): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(slot));
    return true;
  } catch {
    // storage full / private mode — saving is best-effort, but the caller
    // must know: a failed save that clears its dirty flag loses the session
    return false;
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

/**
 * Load with migration. An old-version slot is handed to `migrate` with the
 * version it actually carries — the whole point of shipping a migrate is
 * that bumping the version upgrades players instead of wiping them. The
 * naive load path above discards mismatches before any migrate could run,
 * which made the documented contract a dead letter (audit §G follow-up).
 * A migrate returning null (or an un-upgraded version) discards the slot.
 */
export function loadSlot<W>(
  key: string,
  version: number,
  migrate?: (saved: unknown, fromVersion: number) => unknown | null,
): SaveSlot<W> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const slot = JSON.parse(raw) as SaveSlot<W>;
    if (slot.version === version) return slot;
    if (!migrate) return null;
    const upgraded = migrate(slot, slot.version) as SaveSlot<W> | null;
    return upgraded && upgraded.version === version ? upgraded : null;
  } catch {
    return null;
  }
}

export function clearSave(key: string): void {
  localStorage.removeItem(key);
}
