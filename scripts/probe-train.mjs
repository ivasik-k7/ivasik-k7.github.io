/**
 * probe-train.mjs — look at the SKM unit.
 *
 * The trains run off one 96 s SMIL cycle with a negative `begin`, so the only
 * way to inspect a specific moment (braking in, doors open, pulling away, the
 * near train mid-pass) is to freeze every SVG timeline and put it exactly
 * there. That is what this does: read `begin` off any of the scene's own
 * animations to recover how far into the cycle the mount was, then
 * `setCurrentTime` on every root so the requested cycle second is on screen.
 *
 *   node scripts/probe-train.mjs [baseUrl] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/train-probe";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--hide-scrollbars",
  ],
});

const errors = [];

async function boot(hour) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (hour !== null) {
    await ctx.addInitScript((h) => {
      Date.prototype.getHours = () => h;
    }, hour);
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Enter");
    const up = await page
      .waitForFunction(() => Boolean(window.__game), null, { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (up) break;
  }
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 8000 });
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  return { ctx, page };
}

/**
 * Park the player (and therefore the camera) and freeze the cycle at `sec`.
 *
 * Each outermost <svg> carries its own SMIL timeline, and the scene has several
 * of them created at different moments — artwork, effects, people, foreground.
 * Seeking one is not enough and seeking them all to the same second is the only
 * way they agree. `begin` is read off the scene's own animations rather than
 * assumed: it is negative by however far into the cycle the station was when it
 * first mounted.
 *
 * The readback is the useful part. It reports where each train actually ended up
 * for the requested second, so a shot that comes back empty is diagnosable
 * instead of mysterious.
 */
async function park(page, x, sec) {
  await page.evaluate((px) => window.__game.travel("station", px), x);
  await page.waitForTimeout(900);
  const info = await page.evaluate((target) => {
    const roots = Array.from(document.querySelectorAll("svg"));
    /* Every train animation carries the same `begin`, and other animations in
       the scene (clock hands, the drifting leaf) carry their own — so take the
       value that appears most often rather than the first one found. */
    const tally = new Map();
    for (const e of document.querySelectorAll("animateTransform[begin]")) {
      const n = Number((e.getAttribute("begin") ?? "").replace(/s$/, ""));
      if (Number.isFinite(n) && n > -96 && n <= 0) tally.set(n, (tally.get(n) ?? 0) + 1);
    }
    let begin = 0;
    let best = 0;
    for (const [n, c] of tally) if (c > best) [begin, best] = [n, c];
    const offset = -begin;
    let t = target - offset;
    while (t < 0.5) t += 96;
    for (const r of roots) {
      try {
        r.pauseAnimations();
        r.setCurrentTime(t);
      } catch {
        /* nested svg: not an animation root */
      }
    }
    /* where did the trains actually land? one entry per animated unit */
    const at = Array.from(document.querySelectorAll("animateTransform[type=translate]"))
      .map((a) => a.parentElement)
      .filter((g) => g?.querySelector("path"))
      .map((g) => {
        const m = g.transform?.baseVal?.consolidate?.()?.matrix;
        return m ? Math.round(m.e) : null;
      })
      .filter((v) => v !== null);
    return { offset, t, roots: roots.length, at };
  }, sec);
  await page.waitForTimeout(320);
  return info;
}

const MOMENTS = [
  // [label, cycle second, camera x, note]
  ["quiet", 2, 1900, "empty platform, cab end"],
  ["near-pass", 10, 1000, "the down train a metre and a half away"],
  ["near-pass-cab", 8.6, 900, "its leading cab, just arrived in frame"],
  ["near-pass-tail", 11.4, 900, "and the red markers on the way out"],
  ["express-mid", 23, 1000, "three-car express at speed"],
  ["express-cab", 24.5, 1700, "express cab and beam"],
  ["arrive-brake", 49, 900, "braking in — bob, haze, slowing wheels"],
  ["arrive-crawl", 53, 500, "the last few metres"],
  ["stand-doors", 62, 520, "doors open at door 1"],
  ["stand-cabB", 62, 1900, "the leading cab, standing"],
  ["stand-cabA", 62, 300, "the trailing cab, standing"],
  ["stand-mid", 62, 1100, "mid-unit, standing"],
  ["depart", 84, 900, "pulling away — sand, accelerating wheels"],
];

for (const hour of [13, 22]) {
  const tag = hour === 13 ? "day" : "night";
  const { ctx, page } = await boot(hour);
  await page.evaluate(() => window.__game.travel("station", 520));
  await page.waitForTimeout(1200);
  for (const [label, sec, x, note] of MOMENTS) {
    const info = await park(page, x, sec);
    await page.screenshot({ path: `${OUT}/${tag}-${label}.png` });
    console.log(
      `${tag}-${label}  t=${sec}s x=${x}  (offset ${info.offset.toFixed(1)}s → ${info.t.toFixed(1)}s, ${info.roots} roots)  ${note}`,
    );
  }
  await ctx.close();
}

if (errors.length) {
  console.log("\n--- page errors ---");
  for (const e of [...new Set(errors)]) console.log(e);
  process.exitCode = 1;
} else {
  console.log("\nno page errors");
}
await browser.close();
