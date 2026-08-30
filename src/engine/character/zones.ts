/**
 * zones.ts — the one place a palette letter is given a meaning.
 *
 * Every pass in `morph.ts`, every rule in `validate.ts` and the compiler's
 * face layer used to carry its own private set of letters ("skin is s, S, y"
 * … "cloth is t, T"). They agreed by luck. This module is the vocabulary
 * they now share, so adding a zone (a lit cloth tone, a second accent) is
 * one edit, and a recipe for a different figure can hand in its own table.
 *
 * Roles, not colours: a zone says what a cell *is* (skin, cloth, shoe…),
 * never what hex it paints. Palettes stay per character.
 */

export type ZoneRole =
  | "skin"
  | "eye"
  | "hair"
  | "beard"
  | "hat"
  | "hood"
  | "cloth"
  | "trouser"
  | "shoe"
  | "accent"
  | "prop"
  | "effect"
  | "occlusion";

export interface ZoneTable {
  readonly roles: Readonly<Record<string, ZoneRole>>;
  /** the letter each role's *shade* tone uses, where one exists */
  readonly shade: Readonly<Partial<Record<ZoneRole, string>>>;
  /** the letter each role's base tone uses */
  readonly base: Readonly<Partial<Record<ZoneRole, string>>>;
}

/** The player's (and the street NPCs') letters. */
export const DEFAULT_ZONES: ZoneTable = {
  roles: {
    s: "skin",
    S: "skin",
    y: "skin",
    e: "eye",
    h: "hair",
    H: "hair",
    i: "hair",
    f: "beard",
    F: "beard",
    k: "hat",
    K: "hat",
    j: "hat",
    m: "hood",
    M: "hood",
    t: "cloth",
    T: "cloth",
    l: "cloth",
    p: "trouser",
    q: "trouser",
    Q: "trouser",
    b: "shoe",
    B: "shoe",
    a: "accent",
    A: "accent",
    g: "accent",
    c: "prop",
    n: "prop",
    o: "prop",
    w: "prop",
    W: "prop",
    R: "prop",
    P: "prop",
    G: "prop",
    u: "prop",
    U: "prop",
    v: "effect",
    x: "effect",
    d: "occlusion",
  },
  base: {
    skin: "s",
    cloth: "t",
    trouser: "p",
    shoe: "b",
    hood: "m",
    hat: "k",
    hair: "h",
    accent: "a",
  },
  shade: {
    skin: "S",
    cloth: "T",
    trouser: "q",
    shoe: "B",
    hood: "M",
    hat: "K",
    hair: "H",
    accent: "A",
  },
};

/** Letters with any of the given roles. */
export function lettersOf(z: ZoneTable, ...roles: ZoneRole[]): Set<string> {
  const out = new Set<string>();
  for (const [ch, role] of Object.entries(z.roles)) if (roles.includes(role)) out.add(ch);
  return out;
}

export function isBlank(ch: string | undefined): boolean {
  return ch === undefined || ch === "." || ch === " ";
}

/** True for a letter that is part of the figure (not smoke, not a hole). */
export function isFigure(z: ZoneTable, ch: string | undefined): boolean {
  if (isBlank(ch)) return false;
  const role = z.roles[ch as string];
  return role !== undefined && role !== "effect";
}
