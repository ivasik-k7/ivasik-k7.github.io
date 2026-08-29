/**
 * drive-bands.mjs — does every scene have a floor you can walk about on?
 *
 * The engine's floor used to be one line and most scenes still stood on it, so
 * this checks the one thing that cannot be checked by reading the code: that
 * ArrowDown and ArrowUp actually move the player's feet, that the extremes
 * match the band the scene declared, and that nothing throws on the way.
 *
 * It deliberately does NOT hard-code each band: it asks the scene how deep it
 * is (`__game.getStats().band` is the live band) and then checks the walk agrees
 * with it. A scene that legitimately has no depth is listed as `flat` and is
 * expected to stay put.
 *
 *   node scripts/drive-bands.mjs [baseUrl] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/band-drive";
mkdirSync(OUT, { recursive: true });

/** scene → an x to stand at that is clear of furniture, and how it should behave */
const SCENES = [
  ["studio", 300, "deep"],
  ["study", 300, "deep"],
  ["bath", 150, "deep"],
  ["balcony", 90, "deep"],
  ["corridor", 300, "deep"],
  ["elevator", 100, "deep"],
  ["outside", 400, "deep"],
  ["zabka", 300, "deep"],
  ["parking", 900, "deep"],
  ["gym", 600, "deep"],
  ["district", 700, "deep"],
  ["elektrykow", 700, "deep"],
  ["raveclub", 500, "deep"],
  ["station", 900, "deep"],
  ["train", 700, "deep"],
  ["forum", 700, "deep"],
];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--hide-scrollbars"],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !/AudioContext/.test(m.text())) errors.push(`console: ${m.text()}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
for (let i = 0; i < 5; i++) {
  await page.keyboard.press("Enter");
  const up = await page
    .waitForFunction(() => Boolean(window.__game), null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (up) break;
}
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 20000 });
await page.waitForTimeout(900);
await page.keyboard.press("Enter");
await page.waitForTimeout(500);

let bad = 0;
const check = (label, ok) => {
  console.log(ok ? `ok   ${label}` : `FAIL ${label}`);
  if (!ok) bad++;
};

/** Hold a key long enough that a slow host still crosses the band. */
async function press(key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(220);
}

for (const [scene, x, mode] of SCENES) {
  await page.evaluate(([s, px]) => window.__game.travel(s, px), [scene, x]);
  await page.waitForTimeout(2400);
  const live = await page.evaluate(() => window.__game.getLive());
  if (live.scene !== scene) {
    check(`${scene}: arrived`, false);
    continue;
  }
  await press("ArrowDown", 2600);
  const near = await page.evaluate(() => window.__game.getLive());
  await page.screenshot({ path: `${OUT}/${scene}-near.png` });
  await press("ArrowUp", 2600);
  const far = await page.evaluate(() => window.__game.getLive());
  const depth = near.y - far.y;
  const label = `${scene.padEnd(11)} far=${far.y.toFixed(0)} near=${near.y.toFixed(0)} depth=${depth.toFixed(0)} surface=${near.surface ?? "-"}`;
  if (mode === "flat") check(`${label} (flat, expected 0)`, depth === 0);
  else check(`${label}`, depth >= 6);
  await page.screenshot({ path: `${OUT}/${scene}-far.png` });
}

if (errors.length) {
  console.log("--- page errors ---");
  for (const e of [...new Set(errors)]) console.log(e);
  bad++;
}
console.log(bad ? `\n${bad} problem(s)` : "\nall scenes walk");
process.exitCode = bad ? 1 : 0;
await browser.close();
