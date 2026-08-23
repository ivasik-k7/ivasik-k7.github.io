/**
 * Drive the two new scenes and screenshot them. Forces the wall clock to 23:00
 * so the street renders its prime time; a second pass forces 13:00 for the
 * daytime state. Fails loudly on page errors.
 *
 *   node drive-elektrykow.mjs [baseUrl] [shotDir] [hour]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/claude-1000/elektrykow-shots";
const HOUR = Number(process.argv[4] ?? 23);
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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

// pin the hour before any app code runs
await page.addInitScript((h) => {
  Date.prototype.getHours = () => h;
}, HOUR);

const live = () => page.evaluate(() => window.__game.getLive());
/** Travel and WAIT for arrival — scenes are lazy chunks, so the first visit
 * holds the fade until the chunk lands and a fixed sleep lies about it. */
const go = async (scene, x, y) => {
  await page.evaluate(([s2, tx, ty]) => window.__game.travel(s2, tx, ty), [scene, x, y]);
  await page.waitForFunction((s2) => window.__game.getLive().scene === s2, scene, {
    timeout: 15000,
  });
  await page.waitForTimeout(700);
};
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const check = (label, cond) => {
  console.log(cond ? `ok   ${label}` : `FAIL ${label}`);
  if (!cond) process.exitCode = 1;
};
const tag = HOUR >= 22 || HOUR < 6 ? "night" : "day";

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.keyboard.press("Enter");
await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 15000 });
await page.waitForTimeout(900);
await page.keyboard.press("Enter");
await page.waitForTimeout(500);

// --- Ulica Elektryków --------------------------------------------------------
await go("elektrykow", 120);
const spawn = await live();
check(
  `elektrykow spawns inside the profiled band (y=${spawn.y}, scene=${spawn.scene})`,
  spawn.scene === "elektrykow" && spawn.y >= 150 && spawn.y <= 170,
);
await shot(`elektrykow-${tag}-1-skm`);

for (const [x, y, name] of [
  [470, 158, "2-hala"],
  [880, 162, "3-bar"],
  [1105, 158, "4-frytki"],
  [1290, 162, "5-yard"],
  [1560, 154, "6-club"],
]) {
  await go("elektrykow", x, y);
  await shot(`elektrykow-${tag}-${name}`);
}

// band walk: down and up
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowDown");
const down = await live();
check(`band walk down (y=${down.y})`, down.y > 154);

// --- the club ---------------------------------------------------------------
await go("raveclub", 90);
const club = await live();
check(
  `raveclub reached (scene=${club.scene}, y=${club.y})`,
  club.scene === "raveclub" && club.y === 150,
);
await shot(`raveclub-${tag}-1-door`);

for (const [x, y, name] of [
  [260, 160, "2-bar"],
  [430, 162, "3-chill"],
  [660, 164, "4-floor"],
  [900, 158, "5-dj"],
  [1080, 158, "6-corridor"],
]) {
  await go("raveclub", x, y);
  await shot(`raveclub-${tag}-${name}`);
}

check("no page errors", errors.length === 0);
if (errors.length) console.log(errors.slice(0, 12).join("\n"));
await browser.close();
