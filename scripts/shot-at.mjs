/**
 * shot-at.mjs — stand at given x's in a scene and screenshot each.
 *   node scripts/shot-at.mjs district 160,1130,1420 [hour] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const SCENE = process.argv[2] ?? "district";
const XS = (process.argv[3] ?? "300").split(",").map(Number);
const HOUR = process.argv[4] ? Number(process.argv[4]) : null;
const OUT = process.argv[5] ?? "/tmp/scene-shots";
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
await page.goto(process.env.BASE_URL ?? "http://localhost:5173/", { waitUntil: "networkidle" });
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
for (const x of XS) {
  await page.evaluate(([s, px]) => window.__game.travel(s, px), [SCENE, x]);
  await page.waitForTimeout(2400);
  await page.screenshot({ path: `${OUT}/${SCENE}-x${x}${HOUR === null ? "" : `-h${HOUR}`}.png` });
  console.log(`${SCENE} @ ${x}`);
}
if (errors.length) {
  for (const e of [...new Set(errors)]) console.log(e);
  process.exitCode = 1;
} else console.log("no page errors");
await browser.close();
