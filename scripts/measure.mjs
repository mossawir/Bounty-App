// Local performance measurement. Point BASE_URL at a running dev/preview server.
// Results feed docs/performance.md.
import { chromium } from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

const target = process.argv[2] ?? '/';
const label = process.argv[3] ?? 'run';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const started = Date.now();
await page.goto(`${BASE}${target}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.product-card', { state: 'attached', timeout: 60000 });
const timeToCards = Date.now() - started;

const firstPass = await page.evaluate(() => ({
  nodes: document.querySelectorAll('*').length,
  cards: document.querySelectorAll('.product-card').length,
  listHeight: Math.round(
    document.querySelector('.product-grid')?.getBoundingClientRect().height ?? 0,
  ),
  pageHeight: Math.round(document.body.scrollHeight),
  range: document.querySelector('.pagination-range')?.textContent?.trim() ?? null,
}));

const scrollStarted = Date.now();
await page.mouse.wheel(0, 6000);
await page.waitForTimeout(800);
const afterScroll = await page.evaluate(() => ({
  nodes: document.querySelectorAll('*').length,
  cards: document.querySelectorAll('.product-card').length,
  y: Math.round(window.scrollY),
}));

console.log(
  JSON.stringify({
    label,
    target,
    timeToCardsMs: timeToCards,
    ...firstPass,
    afterScroll,
    scrollMs: Date.now() - scrollStarted,
  }),
);

await context.close();
await browser.close();
