// Génère les icônes PNG de la PWA à partir de public/favicon.svg (via Chromium/Playwright).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.NODE_PATH + '/playwright')); }
import { readFileSync } from 'node:fs';
const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const [name, size, pad] of [['pwa-192-v3.png', 192, 0], ['pwa-512-v3.png', 512, 0], ['apple-touch-icon-v3.png', 180, 0]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;background:#0b0f17">${svg.replace('<svg ', `<svg width="${size - pad * 2}" height="${size - pad * 2}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../public/${name}`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
console.log('Icônes générées');
