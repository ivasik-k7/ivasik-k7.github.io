import { chromium } from "playwright-core";
try {
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
  const page = await browser.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message.slice(0, 200))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.goto("http://localhost:5199/", { waitUntil: "networkidle", timeout: 20000 }); await page.waitForTimeout(1500);
  await page.keyboard.press("Enter"); await page.waitForTimeout(3000);
  console.log("game:", await page.evaluate(() => Boolean(window.__game)));
  console.log(errors.slice(0, 4).join("\n") || "no errors");
  await browser.close();
} catch (e) { console.log("script error:", String(e).slice(0, 300)); }
