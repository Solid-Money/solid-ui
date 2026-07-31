import { execSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../assets');
const ASSETS_FILE = path.join(__dirname, '../lib/assets.ts');

function getFiles(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    if (item.name.startsWith('.') || item.name === 'version.ts') continue;

    const res = path.resolve(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getFiles(res));
    } else {
      files.push(res);
    }
  }
  return files;
}

function getHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
}

// The registry is imported on every platform, so anything listed here ends up
// in every bundle. `.mov` is reserved for iOS-only HEVC-with-alpha video, which
// is required directly from a `.ios.tsx` so Android never pulls it in — see
// components/Rewards/NewRewards/TierHero. Opaque `.mp4` is shared and stays in.
function isPlatformSpecificVideo(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === '.mov';
}

function isDensityVariant(filePath: string): boolean {
  const extension = path.extname(filePath);
  const fileName = path.basename(filePath, extension);

  return /@\d+(?:\.\d+)?x$/.test(fileName);
}

function updateRegistry() {
  // Metro resolves @2x/@3x files automatically from the base asset. Requiring
  // those variants directly makes native bundling fail.
  const allFiles = getFiles(ASSETS_DIR).filter(
    file => !isDensityVariant(file) && !isPlatformSpecificVideo(file),
  );
  const registryEntries: string[] = [];

  for (const file of allFiles) {
    const relativePath = path.relative(ASSETS_DIR, file);
    const hash = getHash(file);
    // Escape single quotes in path if any
    const escapedPath = relativePath.replace(/'/g, "\\'");

    registryEntries.push(
      `  '${escapedPath}': { module: require('@/assets/${escapedPath}'), hash: '${hash}' },`,
    );
  }

  const content = fs.readFileSync(ASSETS_FILE, 'utf8');
  const startMarker = '// @assets-registry-start';
  const endMarker = '// @assets-registry-end';

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find registry markers in lib/assets.ts');
    process.exit(1);
  }

  const newContent =
    content.substring(0, startIndex + startMarker.length) +
    '\n' +
    registryEntries.join('\n') +
    '\n  ' +
    content.substring(endIndex);

  fs.writeFileSync(ASSETS_FILE, newContent);
  console.log(`Updated ${registryEntries.length} assets in the registry.`);

  // Format the file after updating
  try {
    execSync(`npx prettier --write "${ASSETS_FILE}"`);
    console.log('Formatted lib/assets.ts');
  } catch (error) {
    console.error('Failed to format lib/assets.ts:', error);
  }
}

updateRegistry();
