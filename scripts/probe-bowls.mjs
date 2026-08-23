/**
 * probe-bowls.mjs — play MISKI with the mouse, the way a player does.
 *
 * The point of driving this one by pointer rather than by key is that the bowls
 * ARE the controls: the hit areas live inside the stage and slide when Gross
 * shoves a bowl, so a run that only pressed A and D would never exercise the
 * thing most likely to break. It maps stage coordinates onto the page through
 * the stage svg's own bounding box, so it keeps working at any window size.
 *
 *   node scripts/probe-bowls.mjs [baseUrl] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/bowls-probe";
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
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
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
await page.waitForTimeout(800);
await page.keyboard.press("Enter");

/* an unfed dog, and a player he already trusts, so the hard version is exercised */
await page.evaluate(() =>
  window.__game.updateWorld((w) => ({
    ...w,
    studio: { ...(w.studio ?? {}), bowlsFilled: false },
    minigames: { ...(w.minigames ?? {}), bowls: 2 },
  })),
);
await page.evaluate(() => window.__game.travel("studio", 594));
await page.waitForTimeout(2200);
await page.evaluate(() => window.__game.interact("dogbowls"));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/0-intro.png` });

/** The stage's own box, so a scene coordinate can be clicked. */
const box = await page.evaluate(() => {
  const svg = Array.from(document.querySelectorAll("svg")).find(
    (s) => s.getAttribute("viewBox") === "0 0 300 190",
  );
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
if (!box) {
  console.log("FAIL no stage svg — the overlay did not open");
  await browser.close();
  process.exit(1);
}
console.log(
  `stage ${box.w.toFixed(0)}x${box.h.toFixed(0)} at ${box.x.toFixed(0)},${box.y.toFixed(0)}`,
);
const at = (sx, sy) => ({ x: box.x + (sx / 300) * box.w, y: box.y + (sy / 190) * box.h });
const hold = async (sx, sy, ms) => {
  const q = at(sx, sy);
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
};
const click = async (sx, sy) => {
  const q = at(sx, sy);
  await page.mouse.click(q.x, q.y);
};

await click(150, 100); // the frame starts the round
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/1-start.png` });

/* the water bowl: nine notches at four a second, aiming for six or seven */
await hold(124, 148, 1650);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/2-water.png` });

/* the food bowl in two bursts, telling him to wait in between */
await hold(200, 148, 900);
await click(250, 110);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/3-scold.png` });
await hold(200, 148, 700);
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/4-filled.png` });
/* wait out the round — either both bowls land in the band and he is released
   early, or the clock runs down. Either way the verdict is the last beat. */
await page
  .waitForFunction(() => Boolean(document.querySelector(".border-parchment\\/25")), null, {
    timeout: 30000,
    polling: 200,
  })
  .catch(() => {});
await page.screenshot({ path: `${OUT}/5-verdict.png` });

await page.waitForTimeout(4200);
const after = await page.evaluate(() => ({
  scene: window.__game.getLive().scene,
  fed: window.__game.getWorld().studio?.bowlsFilled,
  tier: window.__game.getWorld().minigames?.bowls,
}));
console.log(`back in ${after.scene}, fed=${after.fed}, best tier=${after.tier}`);
if (errors.length) {
  console.log("--- page errors ---");
  for (const e of [...new Set(errors)]) console.log(e);
  process.exitCode = 1;
} else {
  console.log("no page errors");
}
await browser.close();
