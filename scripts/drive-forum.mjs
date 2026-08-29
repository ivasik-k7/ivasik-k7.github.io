/**
 * drive-forum.mjs — Targ Sienny end to end: arrive, walk, look, board the SKM.
 *   node scripts/drive-forum.mjs [baseUrl] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/forum-drive";
mkdirSync(OUT, { recursive: true });
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

let bad = 0;
const check = (label, ok) => {
  console.log(ok ? `ok   ${label}` : `FAIL ${label}`);
  if (!ok) bad++;
};
const live = () => page.evaluate(() => window.__game.getLive());

/* arrive the way the train delivers you: the LINE's spawnX */
await page.evaluate(() => window.__game.travel("forum", 170));
await page.waitForTimeout(2600);
let l = await live();
check(
  `arrives on Targ Sienny (scene=${l.scene}, x=${l.x.toFixed(0)}, y=${l.y})`,
  l.scene === "forum" && l.y >= 150,
);
const hud = await page.evaluate(() =>
  Boolean(document.querySelector('[aria-label*="TARG SIENNY"]')),
);
check("the HUD names the place", hud);
await page.screenshot({ path: `${OUT}/arrive.png` });

/* the band has depth */
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(2400);
await page.keyboard.up("ArrowDown");
await page.waitForTimeout(200);
l = await live();
check(`walks down to the kerb (y=${l.y}, surface=${l.surface})`, l.y >= 166);

/* the well is a hole: you cannot walk into it */
await page.evaluate(() => window.__game.walkTo(110, 158));
await page.waitForTimeout(3000);
l = await live();
check(
  `the SKM well is solid (asked 110,158 got ${l.x.toFixed(0)},${l.y.toFixed(0)})`,
  !(l.x > 64 && l.x < 156 && l.y < 167),
);

/* the entrance prompt appears at the bridge */
/* placed rather than walked: a single walkTo cannot cross 800 px on a headless
   host before its deadline, and the check is about the prompt, not the walk */
await page.evaluate(() => window.__game.travel("forum", 990));
await page.waitForTimeout(2600);
const ent = await page.evaluate(() => Boolean(document.querySelector('[aria-label*="FORUM"]')));
check("the Forum entrance offers a prompt", ent);
await page.screenshot({ path: `${OUT}/entrance.png` });

/* and the SKM takes you back */
await page.evaluate(() => window.__game.travel("forum", 170));
await page.waitForTimeout(2200);
await page.evaluate(() => window.__game.interact("forum-skm"));
await page.waitForTimeout(3600);
l = await live();
check(`the tunnel stair boards the SKM (scene=${l.scene})`, l.scene === "train");

check("no page errors", errors.length === 0);
if (errors.length) console.log([...new Set(errors)].join("\n"));
console.log(bad ? `\n${bad} problem(s)` : "\nforum ok");
process.exitCode = bad ? 1 : 0;
await browser.close();
