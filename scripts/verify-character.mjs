/**
 * verify-character.mjs — look at the live character.
 *   npx vite --port 5199 --strictPort   # in one terminal
 *   node scripts/verify-character.mjs <outdir> [querystring...]
 * For each query: boot ?scene=studio with the params, screenshot a crop around
 * the player at 4×, then walk right for a while capturing every 90 ms into a
 * strip (to catch blinks and the walk cycle in the real light).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const OUT = process.argv[2] ?? "/tmp/char-verify";
const QUERIES = process.argv.slice(3);
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:5199/";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  headless: true,
  args: [
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--hide-scrollbars",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

for (const q of QUERIES) {
  const name = q.replace(/[^a-z0-9]+/gi, "_").slice(0, 60) || "default";
  await page.goto(`${BASE}?scene=studio&x=120&${q}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.keyboard.press("Enter");
  try {
    await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 8000 });
  } catch {
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 15000 });
  }
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  // the look goes in through the world, not the URL: a continued save keeps
  // its own appearance and URL params only seed a new game
  const patch = Object.fromEntries(new URLSearchParams(q));
  await page.evaluate((patch) => {
    window.__game.updateWorld((w) => ({ ...w, appearance: { ...w.appearance, ...patch } }));
  }, patch);
  await page.waitForTimeout(700);
  // where is he on screen? the runtime marks its player element
  const box = async () => {
    const b = await page.locator("[data-player]").boundingBox();
    if (!b) throw new Error("no player element");
    const pad = 24;
    return {
      x: Math.max(0, Math.round(b.x - pad)),
      y: Math.max(0, Math.round(b.y - pad)),
      width: Math.round(b.width + pad * 2),
      height: Math.round(b.height + pad * 2),
    };
  };
  const live = await page.evaluate(() => window.__game.getLive());
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: await box() });
  // walking sweep — one crop per tick, the frame name alongside
  await page.keyboard.down("ArrowRight");
  const walk = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(90);
    walk.push(await page.evaluate(() => window.__game.getLive().frame));
    await page.screenshot({
      path: `${OUT}/${name}.walk${String(i).padStart(2, "0")}.png`,
      clip: await box(),
    });
  }
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(300);
  const idle = [];
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(80);
    idle.push(await page.evaluate(() => window.__game.getLive().frame));
  }
  writeFileSync(`${OUT}/${name}.frames.txt`, `walk: ${walk.join(" ")}\nidle: ${idle.join(" ")}\n`);
  console.log(`${name}: ${live.frame} @ ${live.x}`);
}
if (errors.length) {
  console.log(errors.join("\n"));
  process.exitCode = 1;
}
await browser.close();
