/**
 * bench-game.mjs — the engine's repeatable performance baseline.
 *
 * Measures what the modernization program (docs/ARCHITECTURE.md §Phase 6)
 * budgets: boot (first paint, game-ready), cold scene entry per scene, and
 * idle frame health in the heaviest scenes. Prints a table and writes JSON so
 * two runs can be diffed instead of argued about.
 *
 *   npm run dev                                  # in one terminal
 *   node scripts/bench-game.mjs [baseUrl] [out.json] [baseline.json]
 *
 * With a baseline file the table gains a delta column. Numbers move a few
 * percent run to run — treat <10% as noise, and rerun before believing a
 * regression.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/bench-game.json";
const BASELINE = process.argv[4] ?? null;

const SCENES = ["corridor", "outside", "district", "station", "gym", "zabka"];
const IDLE_SCENES = ["district", "outside"];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--hide-scrollbars",
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const result = { at: new Date().toISOString(), base: BASE, boot: {}, sceneEntry: {}, idle: {} };

// --- boot -------------------------------------------------------------------
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
result.boot.firstPaintMs = await page.evaluate(() => {
  const paint = performance.getEntriesByName("first-contentful-paint")[0];
  return paint ? Math.round(paint.startTime) : null;
});
result.boot.longTasks = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const seen = [];
      try {
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) seen.push(Math.round(e.duration));
        });
        obs.observe({ type: "longtask", buffered: true });
        setTimeout(() => {
          obs.disconnect();
          resolve(seen);
        }, 300);
      } catch {
        resolve(null);
      }
    }),
);
const pressAt = Date.now();
await page.keyboard.press("Enter");
try {
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 8000 });
} catch {
  // the first press can land during menu hydration — once is a retry, twice is a bug
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 12000 });
}
result.boot.enterToGameReadyMs = Date.now() - pressAt;
await page.waitForTimeout(800);
await page.keyboard.press("Enter"); // intro splash, if any
await page.waitForTimeout(400);

// --- cold scene entry ---------------------------------------------------------
// travel() fades 220ms before switching; measure travel call → two settled
// frames in the new scene, minus the fixed fade, so the number is scene cost.
for (const scene of SCENES) {
  const ms = await page.evaluate(
    ([target]) =>
      new Promise((resolve) => {
        const t = performance.now();
        window.__game.travel(target, undefined);
        const check = () => {
          if (window.__game.getLive().scene === target) {
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve(performance.now() - t)),
            );
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      }),
    [scene],
  );
  result.sceneEntry[scene] = Math.round(ms - 220);
  await page.waitForTimeout(400);
}

// --- idle frame health ----------------------------------------------------------
for (const scene of IDLE_SCENES) {
  await page.evaluate(([s]) => window.__game.travel(s, undefined), [scene]);
  await page.waitForTimeout(1200);
  result.idle[scene] = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let last = performance.now();
        const until = last + 3000;
        const loop = (now) => {
          frames.push(now - last);
          last = now;
          if (now < until) requestAnimationFrame(loop);
          else {
            frames.sort((a, b) => a - b);
            const sum = frames.reduce((a, b) => a + b, 0);
            resolve({
              fps: Math.round((frames.length * 1000) / sum),
              p95Ms: Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
              worstMs: Math.round(frames[frames.length - 1] * 10) / 10,
              heapMb:
                performance.memory?.usedJSHeapSize != null
                  ? Math.round(performance.memory.usedJSHeapSize / 1048576)
                  : null,
            });
          }
        };
        requestAnimationFrame(loop);
      }),
  );
}

result.pageErrors = errors;
await browser.close();
writeFileSync(OUT, JSON.stringify(result, null, 2));

// --- report -----------------------------------------------------------------------
const baseline = BASELINE ? JSON.parse(readFileSync(BASELINE, "utf8")) : null;
const delta = (cur, prev) =>
  prev == null || cur == null ? "" : ` (${cur - prev >= 0 ? "+" : ""}${cur - prev})`;

console.log(`bench @ ${result.at}  →  ${OUT}`);
console.log(
  `boot: first paint ${result.boot.firstPaintMs}ms${delta(result.boot.firstPaintMs, baseline?.boot?.firstPaintMs)}, ` +
    `enter→ready ${result.boot.enterToGameReadyMs}ms${delta(result.boot.enterToGameReadyMs, baseline?.boot?.enterToGameReadyMs)}, ` +
    `long tasks [${(result.boot.longTasks ?? []).join(",")}]`,
);
for (const s of SCENES) {
  console.log(
    `scene ${s.padEnd(9)} entry ${String(result.sceneEntry[s]).padStart(5)}ms${delta(result.sceneEntry[s], baseline?.sceneEntry?.[s])}`,
  );
}
for (const s of IDLE_SCENES) {
  const i = result.idle[s];
  console.log(
    `idle  ${s.padEnd(9)} ${i.fps}fps${delta(i.fps, baseline?.idle?.[s]?.fps)}, p95 ${i.p95Ms}ms, worst ${i.worstMs}ms${i.heapMb ? `, heap ${i.heapMb}MB` : ""}`,
  );
}
if (errors.length) {
  console.log(`PAGE ERRORS:\n${errors.join("\n")}`);
  process.exitCode = 1;
}
