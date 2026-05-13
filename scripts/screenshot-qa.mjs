import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:5173/';
const browserExecutable = process.env.QA_CHROMIUM_EXECUTABLE || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const outputDir = path.resolve(process.cwd(), 'qa-screenshots');
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'phone', width: 390, height: 844 },
];

async function safeClick(page, selector, options = {}) {
  const locator = page.locator(selector).first();

  if (await locator.count()) {
    await locator.click(options).catch(() => {});
    await page.waitForTimeout(300);
    return true;
  }

  return false;
}

async function capture(page, viewportName, name) {
  await page.screenshot({
    path: path.join(outputDir, `${viewportName}-${name}.png`),
    fullPage: true,
  });
}

async function captureViewport(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const loginVisible = await page.locator('.login-shell, form').first().isVisible().catch(() => false);

  if (loginVisible) {
    await capture(page, viewport.name, 'login');
    await page.close();
    return;
  }

  await capture(page, viewport.name, 'dashboard');

  await safeClick(page, '.monthly-production-year-button');
  await capture(page, viewport.name, 'monthly-production-year-open');
  await safeClick(page, 'body', { position: { x: 8, y: 8 } });

  await safeClick(page, '.power-year-button');
  await capture(page, viewport.name, 'power-year-open');
  await safeClick(page, 'body', { position: { x: 8, y: 8 } });

  await safeClick(page, '.chemical-year-button');
  await capture(page, viewport.name, 'chemical-year-open');
  await safeClick(page, 'body', { position: { x: 8, y: 8 } });

  const readingsOpened = await safeClick(page, 'button:has-text("Readings")');
  if (readingsOpened) {
    await capture(page, viewport.name, 'readings');
    await safeClick(page, '.export-button');
    await capture(page, viewport.name, 'readings-export-open');
  }

  await page.close();
}

await mkdir(outputDir, { recursive: true });

let browser;

try {
  browser = await chromium.launch(browserExecutable ? { executablePath: browserExecutable } : undefined);
} catch (error) {
  console.error('Unable to launch Chromium for screenshot QA.');
  console.error('Install a browser or set QA_CHROMIUM_EXECUTABLE=/path/to/chrome, then run npm run qa:screenshots.');
  console.error(error.message);
  process.exitCode = 1;
  process.exit();
}

try {
  for (const viewport of viewports) {
    await captureViewport(browser, viewport);
  }
} finally {
  await browser.close();
}

console.log(`Saved screenshots to ${outputDir}`);
