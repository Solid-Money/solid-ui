import { chromium } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';

(async () => {
  // Ensure directory exists
  const authDir = path.join(process.cwd(), 'playwright', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // 1. Launch Google Chrome with a TEMPORARY profile but using the real Chrome binary
  // This gives us access to system authenticators (TouchID) without profile lock issues
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const tempUserDataDir = path.join(os.tmpdir(), `playwright-auth-${Date.now()}`);

  if (!fs.existsSync(chromePath)) {
    console.log('⚠️  Google Chrome not found. Please install Google Chrome for WebAuthn support.');
    process.exit(1);
  }

  console.log('🚀 Launching Google Chrome...');
  console.log('   (Using a temporary profile with access to system TouchID)');
  console.log('');

  // Use launchPersistentContext with a temp directory
  const context = await chromium.launchPersistentContext(tempUserDataDir, {
    headless: false,
    executablePath: chromePath,
  });

  console.log('✅ Browser launched successfully!');
  console.log('');

  // Get existing pages or create a new one
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  // 2. Go to your login page (local dev server)
  const loginUrl = 'http://localhost:8081/onboarding';
  console.log(`Navigating to ${loginUrl}...`);

  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log('');
  console.log('⚠️  Please log in manually with your Passkey in the browser window...');
  console.log('   (Click the "Login" button and use TouchID when prompted)');
  console.log('');
  console.log('📋 After you are logged in and see the home screen,');
  console.log('   press ENTER in this terminal to save your session.');
  console.log('');

  // Set up URL monitoring for debugging
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      console.log(`   [URL changed to: ${frame.url()}]`);
    }
  });

  // Wait for user to press Enter
  await new Promise<void>(resolve => {
    process.stdin.resume();
    process.stdin.once('data', () => {
      resolve();
    });
  });

  console.log('🎉 Saving session...');

  // 4. Save the storage state (cookies, local storage, etc.)
  const storagePath = path.join(authDir, 'user.json');
  await context.storageState({ path: storagePath });

  console.log(`✅ Auth state saved to ${storagePath}`);

  // Clean up temp directory
  await context.close();
  fs.rmSync(tempUserDataDir, { recursive: true, force: true });

  process.exit(0);
})();
