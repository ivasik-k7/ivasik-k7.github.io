/**
 * shot-scenes.mjs — look at a scene's floor from both ends of its band.
 *
 *   node scripts/shot-scenes.mjs studio,bath,parking [hour] [shotDir]
 *
 * Travels to each scene named, stands the player at the top of the band and
 * again at the bottom, and screenshots both. `hour` pins Date.getHours so the
 * same floor can be looked at in daylight and after dark.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const SCENES = (process.argv[2] ?? "studio").split(",");
const HOUR = process.argv[3] ? Number(process.argv[3]) : null;
const OUT = process.argv[4] ?? "/tmp/scene-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--hide-scrollbars"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
if (HOUR !== null) {
  await ctx.addInitScript((h) => {
    Date.prototype.getHours = () => h;
  }, HOUR);
}
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(2200);
for (let i = 0; i < 5; i++) {
  await page.keyboard.press("Enter");
  const up = await page
    .waitForFunction(() => Boolean(window.__game), null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (up) break;
}
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 20000 });
await page.waitForTimeout(800);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);

const X = {
  studio: 300,
  study: 300,
  bath: 150,
  balcony: 120,
  corridor: 300,
  elevator: 100,
  outside: 500,
  zabka: 300,
  parking: 700,
  gym: 600,
  district: 700,
};
const tag = HOUR === null ? "" : `-h${HOUR}`;
for (const scene of SCENES) {
  await page.evaluate(([s, x]) => window.__game.travel(s, x), [scene, X[scene] ?? 300]);
  await page.waitForTimeout(2200);
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(1500);
  await page.keyboard.up("ArrowUp");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${scene}${tag}-far.png` });
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(2600);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${scene}${tag}-near.png` });
  console.log(`${scene}${tag}: far + near`);
}
if (errors.length) {
  for (const e of [...new Set(errors)]) console.log(e);
  process.exitCode = 1;
} else console.log("no page errors");
await browser.close();
