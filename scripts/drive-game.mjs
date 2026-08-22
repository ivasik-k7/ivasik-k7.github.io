/**
 * drive-game.mjs — headless smoke drive of the running game.
 *
 * The seed of the engine's verification harness (docs/ARCHITECTURE.md, Phase 6):
 * boots the title screen, starts a game, exercises the ground band (walk
 * down/up, diagonals, walkTo with depth, a degenerate scene) and screenshots
 * every station. Fails loudly on any page error.
 *
 *   npm run dev            # in one terminal
 *   node scripts/drive-game.mjs [baseUrl] [shotDir]
 *
 * Chrome flags matter: without the two --disable-backgrounding-* switches,
 * headless Chrome throttles rAF and the sim never moves.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/game-drive";
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

const live = () => page.evaluate(() => window.__game.getLive());
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const check = (label, cond) => {
  console.log(cond ? `ok   ${label}` : `FAIL ${label}`);
  if (!cond) process.exitCode = 1;
};

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.keyboard.press("Enter"); // NEW GAME / CONTINUE
try {
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 8000 });
} catch {
  // a cold dev server can still be hydrating the menu when the first press
  // lands — once is a retry, twice is a bug
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 15000 });
}
await page.waitForTimeout(1000);
await page.keyboard.press("Enter"); // intro splash, if any
await page.waitForTimeout(600);

// --- ground band: the corridor pilot ---------------------------------------
await page.evaluate(() => window.__game.travel("corridor", 280));
await page.waitForTimeout(900);
const spawn = await live();
check(`corridor spawns on the band top (y=${spawn.y})`, spawn.y === 150);
await shot("corridor-top");

await page.keyboard.down("ArrowDown");
await page.waitForTimeout(900);
await page.keyboard.up("ArrowDown");
await page.waitForTimeout(300);
const down = await live();
check(`ArrowDown walks to the band bottom (y=${down.y})`, down.y === 170);
await shot("corridor-down");

await page.keyboard.down("KeyW");
await page.keyboard.down("KeyA");
await page.waitForTimeout(700);
await page.keyboard.up("KeyW");
await page.keyboard.up("KeyA");
await page.waitForTimeout(200);
const diag = await live();
check(
  `W+A walks up-left (y=${diag.y}, facing=${diag.facing})`,
  diag.y === 150 && diag.facing === -1,
);

const walked = await page.evaluate(() => window.__game.walkTo(360, 168));
const at = await live();
check(
  `walkTo(360,168) arrives (${at.x},${at.y})`,
  walked && Math.abs(at.x - 360) <= 2 && Math.abs(at.y - 168) <= 2,
);
await shot("corridor-walkto");

// --- degenerate scene: the old single line, bit-identical -------------------
await page.evaluate(() => window.__game.travel("studio", 120));
await page.waitForTimeout(900);
await page.keyboard.down("ArrowDown");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowDown");
const flat = await live();
check(`flat scene pins y to the floor line (y=${flat.y})`, flat.y === 150);
await shot("studio-flat");

// --- depth is remembered per scene ------------------------------------------
await page.evaluate(() => window.__game.travel("corridor"));
await page.waitForTimeout(800);
const back = await live();
check(`corridor remembers the last depth (y=${back.y})`, back.y > 150);

check("no page errors", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
