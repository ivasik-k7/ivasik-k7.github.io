/**
 * What this build is.
 *
 * The three values are substituted as literals by Vite at build time (see the
 * `define` block in vite.config.ts) — there is no runtime lookup, no fetch of a
 * version.json, and nothing to keep in sync by hand.
 *
 * `MODE` distinguishes a `vite build` from a dev server, so the title screen
 * can say DEV without anyone having to remember to change it back.
 */

declare const __BUILD_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_DATE__: string;

export interface BuildInfo {
  /** package.json version, e.g. "0.1.0" */
  version: string;
  /** short commit sha, with a trailing "+" when the tree was dirty */
  commit: string;
  /** ISO date the bundle was built, e.g. "2026-08-20" */
  date: string;
  /** "development" while the dev server is running, "production" in a bundle */
  mode: string;
  /** true for a dev server or a build made from a dirty tree */
  dev: boolean;
}

const version = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__ : "0.0.0";
const commit = typeof __BUILD_COMMIT__ === "string" ? __BUILD_COMMIT__ : "unknown";
const date = typeof __BUILD_DATE__ === "string" ? __BUILD_DATE__ : "";
const mode = import.meta.env.MODE;

export const BUILD: BuildInfo = {
  version,
  commit,
  date,
  mode,
  dev: mode !== "production" || commit.endsWith("+"),
};

/**
 * The one-line stamp for the corner of the title screen: `v0.1.0 · a1b2c3d`,
 * with `DEV` appended when it is not a clean production build.
 *
 * Set in the 3×5 pixel font, which has no lower case, so this is upper-cased
 * at the call site rather than here — the same string is also wanted verbatim
 * in the credits and in a bug report.
 */
export function buildStamp(): string {
  const parts = [`v${BUILD.version}`, BUILD.commit];
  if (BUILD.dev) parts.push("dev");
  return parts.join(" · ");
}
