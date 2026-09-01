import fs from 'fs';
import path from 'path';

/**
 * Guards the wiring that decides which platform variant actually ships.
 *
 * Metro platform-resolves the *specifier being imported*, not the contents of
 * the file it lands on. So a directory barrel that names a variant outright —
 * `export { default } from './Foo.web'` — serves that variant to every platform
 * unless an `index.<platform>` sibling exists to be resolved ahead of it. The
 * mistake is invisible on web and to `tsc`, because both read the file that
 * works.
 *
 * It shipped the thirdweb-backed web `DepositExternalWalletOptions` to Android,
 * where `useActiveAccount()` throws "must be used within <ThirdwebProvider>"
 * (the provider is mounted on desktop only) — the largest error-boundary crash
 * in the August Amplitude data at 57 events. Two sibling barrels had the same
 * defect without crashing: they silently rendered the web component on native.
 */

const REPO_ROOT = path.join(__dirname, '..');
const SEARCH_ROOTS = ['components', 'lib', 'hooks', 'app'];
const EXTS = ['.tsx', '.ts'] as const;

type Barrel = { file: string; target: string; platform: string };

/** Every file that re-exports from a hardcoded platform-specific sibling. */
function hardcodedBarrels(): Barrel[] {
  const found: Barrel[] = [];
  const skip = new Set(['node_modules', '.git', 'ios', 'android', '.expo', 'dist', '__tests__']);

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;
      for (const m of fs
        .readFileSync(full, 'utf8')
        .matchAll(/(?:from|require\()\s*['"]\.\/([\w.-]+)\.(native|web|ios|android)['"]/g)) {
        found.push({ file: full, target: m[1], platform: m[2] });
      }
    }
  };

  for (const root of SEARCH_ROOTS) {
    const dir = path.join(REPO_ROOT, root);
    if (fs.existsSync(dir)) walk(dir);
  }
  return found;
}

const exists = (dir: string, base: string) =>
  EXTS.some(e => fs.existsSync(path.join(dir, base + e)));

describe('platform-variant barrels', () => {
  it('gives every platform variant a matching index entry', () => {
    const offenders: string[] = [];

    for (const { file, target, platform } of hardcodedBarrels()) {
      const dir = path.dirname(file);
      const barrelPlatform =
        path
          .basename(file)
          .replace(/\.tsx?$/, '')
          .split('.')[1] ?? '';
      const isIndex =
        path
          .basename(file)
          .replace(/\.tsx?$/, '')
          .split('.')[0] === 'index';

      // Only `index*` barrels are reached by a directory import. A sibling barrel
      // named `Foo.tsx` is shadowed by `Foo.<platform>` on every platform that
      // has one, so it is inert.
      if (!isIndex) continue;
      // `index.native.tsx` pointing at `.native` is the counterpart, not a bug.
      if (barrelPlatform && barrelPlatform === platform) continue;

      // Every *other* variant present in this directory needs its own index
      // entry, or Metro never reaches it.
      for (const other of ['native', 'web', 'ios', 'android']) {
        if (other === platform) continue;
        if (!exists(dir, `${target}.${other}`)) continue;
        if (exists(dir, `index.${other}`)) continue;
        offenders.push(
          `${path.relative(REPO_ROOT, file)}: serves ${target}.${platform} to all platforms — ` +
            `${target}.${other}.tsx exists but there is no index.${other}, so it is dead code`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it('resolves the deposit barrels that crashed to their native variants', () => {
    // Belt and braces on the specific regression: these are reached by a
    // directory import, so the entry Metro lands on decides what Android runs.
    // jest-expo resolves through the native platform extensions, as Metro does.
    for (const rel of [
      'components/DepositOption/DepositExternalWalletOptions',
      'components/DepositOption/DepositBuyCryptoOptions',
      'components/DepositToVault/DepositTokenSelector',
    ]) {
      const dir = path.join(REPO_ROOT, rel);
      expect(require.resolve(dir)).toMatch(/index\.native\.tsx$/);
      // ...and that entry must lead to the native component, not the web one.
      expect(fs.readFileSync(require.resolve(dir), 'utf8')).toMatch(/\.native';/);
    }
  });
});
