import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

/**
 * This setup checks if authentication already exists.
 * If auth exists with valid user data, it skips setup.
 * If not, you need to manually create the auth file.
 *
 * TO CREATE AUTH MANUALLY:
 * 1. Log in to your app in a regular browser
 * 2. Open DevTools Console (F12 → Console)
 * 3. Run: copy(JSON.stringify({cookies:await cookieStore.getAll(),origins:[{origin:location.origin,localStorage:Object.keys(localStorage).map(k=>({name:k,value:localStorage[k]}))}]},null,2))
 * 4. Paste into playwright/.auth/user.json
 * 5. Save and run tests!
 */
setup('use existing auth', async () => {
  // Check if auth file exists
  if (!fs.existsSync(authFile)) {
    console.log('❌ No auth file found at:', authFile);
    console.log('📋 Please create it manually by copying your browser session');
    throw new Error('Auth file not found. Please create playwright/.auth/user.json manually.');
  }

  // Read and validate the auth file
  const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));

  // Check if it has user data
  const hasUsers = authData.origins?.some((origin: any) => {
    return origin.localStorage?.some((item: any) => {
      if (item.name?.includes('flash_user')) {
        const parsed = JSON.parse(item.value);
        return parsed?.state?.users?.length > 0;
      }
      return false;
    });
  });

  if (hasUsers) {
    console.log('✅ Authentication file found with valid user data');
    console.log('📄 Using existing auth from:', authFile);
    console.log('🎉 Tests will run with authenticated session');
  } else {
    console.log('⚠️  Auth file exists but has no user data');
    console.log('📋 Please update playwright/.auth/user.json with your logged-in session');
    throw new Error('Auth file has no users. Please copy your browser session.');
  }
});
