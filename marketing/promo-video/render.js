#!/usr/bin/env node
/**
 * Frame renderer for the Solid app promo video.
 *
 * video.html exposes window.__render(t) which sets every animated property from
 * a single time value, so capture is fully deterministic: we drive the clock
 * ourselves and screenshot each frame rather than recording wall-clock playback.
 *
 *   node render.js <vertical|wide> <outDir> [fps]
 */
const path = require('path');
const fs = require('fs');

const { chromium } = require('playwright-core');

const FORMATS = {
  vertical: { width: 1080, height: 1920, query: '' },
  wide: { width: 1920, height: 1080, query: '?wide' },
};

async function main() {
  const format = process.argv[2] || 'vertical';
  const outDir = process.argv[3] || path.join(__dirname, 'build', 'frames-' + format);
  const fps = Number(process.argv[4] || 30);

  const spec = FORMATS[format];
  if (!spec) throw new Error(`unknown format "${format}" (expected: ${Object.keys(FORMATS).join(', ')})`);

  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
      '--force-color-profile=srgb',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: spec.width, height: spec.height },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error('page error:', e.message));

  await page.goto('file://' + path.join(__dirname, 'video.html') + spec.query, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready===true', { timeout: 30000 });
  await page.waitForTimeout(400);

  const duration = await page.evaluate('window.__dur');
  const total = Math.round(duration * fps);
  console.log(`rendering ${total} frames (${duration}s @ ${fps}fps) at ${spec.width}x${spec.height}`);

  for (let i = 0; i < total; i++) {
    await page.evaluate((t) => window.__render(t), i / fps);
    await page.screenshot({
      path: path.join(outDir, 'f' + String(i).padStart(5, '0') + '.jpg'),
      type: 'jpeg',
      quality: 94,
    });
    if (i % 120 === 0) console.log(`  frame ${i}/${total}`);
  }
  console.log(`done -> ${outDir}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
