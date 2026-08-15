import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// GitHub Pages serves 404.html for unknown paths. Copying the SPA shell there
// makes client-side routes (TanStack Router) survive hard refreshes and deep links.
const dist = resolve(import.meta.dirname, "../dist");
const index = resolve(dist, "index.html");

if (!existsSync(index)) {
  console.error("prerender: dist/index.html not found — run `vite build` first");
  process.exit(1);
}

copyFileSync(index, resolve(dist, "404.html"));
console.log("prerender: dist/404.html written (SPA fallback)");
