import { put } from '@vercel/blob';
import fs from 'fs';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * This script uploads all assets in the assets/ directory to Vercel Blob.
 * It preserves the directory structure.
 *
 * Usage:
 * BLOB_READ_WRITE_TOKEN=your_token npx ts-node scripts/upload-assets.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../assets');

async function uploadAssets() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN is not set.');
    console.log('Please provide it as an environment variable.');
    process.exit(1);
  }

  // Find all assets excluding those that shouldn't be on CDN (like .tsx wrappers if any)
  const files = await glob('**/*.{png,jpg,jpeg,webp,json,ttf,svg}', {
    cwd: ASSETS_DIR,
    nodir: true,
  });

  console.log(`🔍 Found ${files.length} assets. Starting upload...`);

  for (const file of files) {
    const filePath = path.join(ASSETS_DIR, file);
    const fileBuffer = fs.readFileSync(filePath);

    try {
      // We use the relative path as the blob name to preserve structure
      // e.g. "images/usdc.png"
      const blob = await put(file, fileBuffer, {
        access: 'public',
        token: token,
        addRandomSuffix: false, // CRITICAL: This allows us to predict the URL
      });

      console.log(`✅ Uploaded: ${file} -> ${blob.url}`);
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
    }
  }

  console.log('\n✨ All assets synced to CDN!');
}

uploadAssets().catch(console.error);
