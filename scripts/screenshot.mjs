// One-off local dev tool for visually verifying the real running UI — not
// part of the app itself. Run: node scripts/screenshot.mjs
import { chromium } from "playwright";

const out = process.argv[2] || "/tmp/screenshots";
const base = "http://127.0.0.1:8787";

const pages = [
  { path: "/", name: "home", width: 900 },
  { path: "/", name: "home-mobile", width: 390 },
  { path: "/incident/1", name: "incident-detail", width: 900 },
];

// This dev sandbox routes egress through an HTTP proxy that curl/node fetch
// pick up automatically via HTTPS_PROXY, but Chromium needs it passed
// explicitly to actually reach fonts.googleapis.com — without this the
// screenshots show the (still-legible) system-serif fallback instead of
// the real Newsreader/IBM Plex Mono web fonts. Real user browsers need no
// such flag; this is purely a local-verification concern.
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--headless=new", ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`] : [])],
});
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.width, height: 1000 } });
  await page.goto(`${base}${p.path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${p.name}.png`, fullPage: true });
  await page.close();
  console.log(`saved ${p.name}.png`);
}
await browser.close();
