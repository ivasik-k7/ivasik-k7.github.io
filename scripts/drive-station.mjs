/**
 * drive-station.mjs — verification drive for the rebuilt Przymorze-Uniwersytet
 * platform. Modeled on scripts/drive-game.mjs. Runs two browser contexts:
 * one at the real hour (day), one with getHours shimmed to 22 (night).
 *
 *   node drive-station.mjs [baseUrl] [shotDir]
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:5173/";
const OUT = process.argv[3] ?? "/tmp/station-drive";
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
const check = (label, cond) => {
  console.log(cond ? `ok   ${label}` : `FAIL ${label}`);
  if (!cond) process.exitCode = 1;
};

async function boot(nightShim) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  if (nightShim) {
    await ctx.addInitScript(() => {
      Date.prototype.getHours = () => 22;
    });
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Enter");
    const up = await page
      .waitForFunction(() => Boolean(window.__game), null, { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    if (up) break;
  }
  await page.waitForFunction(() => Boolean(window.__game), null, { timeout: 6000 });
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  return { ctx, page };
}

const liveOf = (page) => page.evaluate(() => window.__game.getLive());
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

// ---------------------------------------------------------------- day context
{
  const { ctx, page } = await boot(false);
  await page.evaluate(() => window.__game.travel("station", 520));
  await page.waitForTimeout(1000);
  const spawn = await liveOf(page);
  check(`station spawns inside the band (y=${spawn.y})`, spawn.y >= 152 && spawn.y <= 170);
  await shot(page, "day-spawn-520");

  // band depth
  await page.keyboard.down("ArrowDown");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowDown");
  await page.waitForTimeout(200);
  const down = await liveOf(page);
  check(`ArrowDown reaches the band bottom (y=${down.y})`, down.y === 170);

  // blocker: try to walk into the biletomat's back-lane footprint
  await page.evaluate(() => window.__game.walkTo(430, 154, { timeoutMs: 6000 }));
  const before = await liveOf(page);
  await page.evaluate(() => window.__game.walkTo(487, 154, { timeoutMs: 4000 }));
  const inBlk = await liveOf(page);
  check(
    `biletomat back lane is blocked (asked 487,154 got ${inBlk.x},${inBlk.y})`,
    !(inBlk.x > 466 && inBlk.x < 512 && inBlk.y >= 152 && inBlk.y <= 158),
  );
  check(`walked from (${before.x},${before.y})`, true);

  // stair hole: front lane blocked, lip walkable
  await page.evaluate(() => window.__game.walkTo(220, 153, { timeoutMs: 6000 }));
  await page.evaluate(() => window.__game.walkTo(150, 153, { timeoutMs: 6000 }));
  const lip = await liveOf(page);
  check(
    `the stair lip is walkable (x=${lip.x}, y=${lip.y})`,
    Math.abs(lip.x - 150) <= 3 && lip.y <= 156,
  );
  await page.evaluate(() => window.__game.walkTo(150, 168, { timeoutMs: 3000 }));
  const hole = await liveOf(page);
  check(
    /* stopping ON the blocker's boundary row (y=157) is correct — inside is beyond it */
    `the stair opening is not (asked 150,168 got ${hole.x},${hole.y})`,
    !(hole.x > 110 && hole.x < 192 && hole.y >= 158),
  );
  await shot(page, "day-stairs-end");

  // kasownik prompt
  await page.evaluate(() => window.__game.walkTo(545, 160, { timeoutMs: 30000 }));
  const kasPrompt = await page
    .waitForFunction(() => Boolean(document.querySelector('[aria-label*="KASOWNIK"]')), null, {
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);
  check("kasownik offers a prompt", kasPrompt);
  await shot(page, "day-biletomat-kasownik");

  // shelter + cast + clock
  await page.evaluate(() => window.__game.walkTo(830, 164, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "day-shelter");

  // mid bench + SOS + pigeur zone
  await page.evaluate(() => window.__game.walkTo(1180, 160, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "day-midbench");

  // far end: smoker (should be absent by day), cabinet, ramp, end board
  await page.evaluate(() => window.__game.walkTo(1700, 160, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "day-far-end");

  // crowd 3 + golebiarka zone by day
  await page.evaluate(() =>
    window.__game.updateWorld((w) => ({ ...w, station: { crowd: 3, pigeons: true } })),
  );
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__game.walkTo(380, 162, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "day-golebiarka-crowd3");

  // rain
  await page.evaluate(() =>
    window.__game.updateWorld((w) => ({ ...w, station: { weather: "rain", crowd: 2 } })),
  );
  await page.waitForTimeout(700);
  await shot(page, "day-rain");

  // wait for the boarding window and check a door prompt appears
  await page.evaluate(() =>
    window.__game.updateWorld((w) => ({ ...w, station: { weather: "clear" } })),
  );
  await page.evaluate(() => window.__game.walkTo(960, 153, { timeoutMs: 30000 }));
  const sawDoor = await page
    .waitForFunction(() => Boolean(document.querySelector('[aria-label*="CARRIAGE DOOR"]')), null, {
      timeout: 100000,
    })
    .then(() => true)
    .catch(() => false);
  check("a carriage door prompt appears during the boarding window", sawDoor);
  await shot(page, "day-train-boarding");
  await ctx.close();
}

// -------------------------------------------------------------- night context
{
  const { ctx, page } = await boot(true);
  await page.evaluate(() => window.__game.travel("station", 520));
  await page.waitForTimeout(1000);
  await shot(page, "night-shelter");
  await page.evaluate(() => window.__game.walkTo(1180, 160, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "night-mid");
  // smoker should be out after dark — walkTo can stall on a busy platform, so
  // press on until we actually stand next to him
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__game.walkTo(1614, 158, { timeoutMs: 15000 }));
    const at = await liveOf(page);
    if (Math.abs(at.x - 1614) <= 6) break;
  }
  const smoker = await page
    .waitForFunction(() => Boolean(document.querySelector('[aria-label*="NEIGHBOR"]')), null, {
      timeout: 5000,
    })
    .then(() => true)
    .catch(() => false);
  check("the smoker is out after dark", smoker);
  await shot(page, "night-smoker-end");
  // wet night reflections
  await page.evaluate(() =>
    window.__game.updateWorld((w) => ({ ...w, station: { weather: "wet" } })),
  );
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__game.walkTo(970, 160, { timeoutMs: 30000 }));
  await page.waitForTimeout(400);
  await shot(page, "night-wet");
  await ctx.close();
}

check("no page errors", errors.length === 0);
if (errors.length) console.log(errors.join("\n"));
await browser.close();
