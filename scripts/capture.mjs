// Local screenshot / smoke script. Not part of the build or CI.
// Requires Chrome installed; uses playwright-core so no browser download is needed.
import { chromium } from 'playwright-core';

const CHROME =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = '.shots';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function shoot(page, name, fullPage = false) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log('shot', name);
}

const errors = [];

const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await desktop.newPage();
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(String(error)));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await shoot(page, '01-home');

// Open a product that is actually in stock: take a card whose Add button is enabled.
const addButtons = page.getByRole('button', { name: /^Add to cart/ });
const card = addButtons.first().locator('xpath=ancestor::article');
await card.getByRole('link').first().click();
await page.waitForLoadState('networkidle');
await shoot(page, '02-detail');

await page.locator('.detail-buy').getByRole('button', { name: /^Add to cart/ }).click();
await page.locator('header').getByRole('link', { name: /^Cart/ }).click();
await page.waitForLoadState('networkidle');
await shoot(page, '03-cart');

await page.getByRole('link', { name: 'Go to checkout' }).click();
await page.waitForURL(/login/);
await shoot(page, '04-login-redirect');

await page.getByRole('button', { name: 'Fill demo credentials' }).click();
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL(/checkout/);
await shoot(page, '05-checkout');

await page.getByRole('button', { name: /Place order/ }).click();
await page.waitForURL(/orders/);
await shoot(page, '06-order');

// Filtered + searched list, to check the empty and filtered states.
await page.goto(`${BASE}/?search=coffee&inStock=true&sort=price-desc`, {
  waitUntil: 'networkidle',
});
await shoot(page, '07-filtered');

// Mobile.
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const mpage = await mobile.newPage();
mpage.on('pageerror', (error) => errors.push(String(error)));
await mpage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await shoot(mpage, '08-mobile-home');
await mpage.goto(`${BASE}/cart`, { waitUntil: 'networkidle' });
await shoot(mpage, '09-mobile-cart');

// Wide, tall view of the virtualized shelf after a scroll.
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.mouse.wheel(0, 5200);
await page.waitForTimeout(900);
await shoot(page, '10-scrolled');

console.log('console errors:', errors.length ? errors : 'none');
await browser.close();
