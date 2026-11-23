// Local performance measurement. Starts nothing on its own: point BASE_URL at a
// running dev/preview server. Results feed docs/performance.md.
import { chromium } from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function measure(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const started = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.product-card', { state: 'attached', timeout: 60000 });
  const timeToCards = Date.now() - started;

  const firstPass = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    cards: document.querySelectorAll('.product-card').length,
    listHeight: document.querySelector('.product-grid')?.getBoundingClientRect().height ?? 0,
  }));

  // Scroll deep into the shelf and count again: virtualization should keep it flat.
  const scrollStarted = Date.now();
  await page.mouse.wheel(0, 30000);
  await page.waitForTimeout(1200);
  const scrolled = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    cards: document.querySelectorAll('.product-card').length,
    y: Math.round(window.scrollY),
  }));
  const scrollMs = Date.now() - scrollStarted;

  console.log(
    JSON.stringify({
      label,
      timeToCardsMs: timeToCards,
      ...firstPass,
      afterScroll: scrolled,
      scrollMs,
    }),
  );

  await context.close();
}

await measure(process.argv[2] ?? 'run');
await browser.close();
