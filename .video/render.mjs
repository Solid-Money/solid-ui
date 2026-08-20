import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import { startServer } from './server.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  })
);

const CFG = {
  width: Number(args.width || 1080),
  height: Number(args.height || 1350),
  fps: Number(args.fps || 60),
  // Motion-blur subsampling: render sub x fps, average `sub` frames -> 180deg shutter.
  sub: Number(args.sub || 1),
  duration: Number(args.duration || 27),
  start: Number(args.start || 0),
  out: args.out || 'out/solid-rewards.mp4',
  crf: Number(args.crf || 16),
  scale: Number(args.scale || 1),
  variant: args.variant || 'feed',
};

const renderW = Math.round(CFG.width * CFG.scale);
const renderH = Math.round(CFG.height * CFG.scale);

async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--font-render-hinting=none',
      '--disable-gpu-vsync',
      '--hide-scrollbars',
      '--enable-font-antialiasing',
      '--disable-frame-rate-limit',
    ],
  });
}

async function makePage(browser) {
  const page = await browser.newPage({
    viewport: { width: renderW, height: renderH },
    deviceScaleFactor: 1,
  });
  const { port } = globalThis.__srv;
  await page.goto(
    `http://127.0.0.1:${port}/index.html?w=${CFG.width}&h=${CFG.height}&scale=${CFG.scale}&variant=${CFG.variant}${args.norim?'&norim=1':''}${args.noglass?'&noglass=1':''}${args.sep!==undefined?'&sep='+args.sep:''}`,
    { waitUntil: 'load' }
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  /* raw CDP capture skips Playwright's stability checks and PNG re-encode */
  const cdp = await page.context().newCDPSession(page);
  page.__grab = async () => {
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png', optimizeForSpeed: true, captureBeyondViewport: false,
    });
    return Buffer.from(data, 'base64');
  };
  return page;
}

async function still(page, t, outFile) {
  await page.evaluate((tt) => window.__seek(tt), t);
  await page.screenshot({ path: outFile, type: 'png' });
}

async function main() {
  globalThis.__srv = await startServer(0);
  const browser = await launch();
  const page = await makePage(browser);

  if (args.still !== undefined) {
    const times = String(args.still)
      .split(',')
      .map((s) => Number(s));
    fs.mkdirSync('out/stills', { recursive: true });
    for (const t of times) {
      const f = `out/stills/t${String(t).replace('.', '_')}.png`;
      await still(page, t, f);
      console.log('still', t, '->', f);
    }
    await browser.close();
    globalThis.__srv.server.close();
    return;
  }

  // ---- full render, piped straight into ffmpeg (no intermediate files) ----
  const outPath = CFG.out;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const srcFps = CFG.fps * CFG.sub;
  const vf = [];
  if (CFG.sub > 1) vf.push(`tmix=frames=${CFG.sub}:weights='${Array(CFG.sub).fill(1).join(' ')}'`);
  vf.push(`fps=${CFG.fps}`);
  if (CFG.scale !== 1) vf.push(`scale=${CFG.width}:${CFG.height}:flags=lanczos`);
  vf.push('format=yuv420p');

  const ff = spawn(
    ffmpegPath,
    [
      '-y',
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'image2pipe',
      '-c:v', 'png',
      '-r', String(srcFps),
      '-i', '-',
      '-vf', vf.join(','),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', String(CFG.crf),
      '-profile:v', 'high',
      '-level', '4.2',
      '-movflags', '+faststart',
      '-r', String(CFG.fps),
      outPath,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );

  const total = Math.round(CFG.duration * srcFps);
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = CFG.start + i / srcFps;
    await page.evaluate((tt) => window.__seek(tt), t);
    const buf = await page.__grab();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0 || i === total - 1) {
      const el = (Date.now() - t0) / 1000;
      const pct = ((i + 1) / total) * 100;
      const eta = el / ((i + 1) / total) - el;
      process.stdout.write(
        `\rframe ${i + 1}/${total}  ${pct.toFixed(1)}%  elapsed ${el.toFixed(0)}s  eta ${eta.toFixed(0)}s   `
      );
    }
  }
  ff.stdin.end();
  await new Promise((res, rej) => {
    ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c))));
  });
  console.log(`\ndone -> ${outPath} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);

  await browser.close();
  globalThis.__srv.server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
