import fs from 'fs';
import path from 'path';

import { assetLabel } from '@/lib/utils/cardHelpers';

/**
 * Regression guard for the Rain card withdrawal crash.
 *
 * `CardWithdrawForm` renders a hint naming the other assets a card holds, and
 * built it with `assetLabel`. `assetLabel` was exported from
 * `ToDestinationSelector.web.tsx`; the `.native.tsx` sibling imported it for its
 * own use but never re-exported it. Metro resolves `.native` ahead of `.web` on
 * iOS/Android, so on device
 * `import { assetLabel } from '.../ToDestinationSelector'` was `undefined`, and
 * calling it threw "undefined is not a function" from inside a `useMemo` during
 * render — which took the whole app to the error boundary the moment the
 * collateral query resolved. Because the query refetches on an interval, "Try
 * again" crashed straight back.
 *
 * Two things are checked: the helper is reachable wherever the withdraw form
 * imports it from, and platform variants never disagree about their exports
 * again.
 */

const CARD_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(CARD_DIR, '..', '..');

/** Value (non-type) named exports declared in a source file. */
function valueExports(file: string): Set<string> {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set<string>();

  for (const m of src.matchAll(
    /^export\s+(?:const|let|var|function|async\s+function|class)\s+(\w+)/gm,
  )) {
    names.add(m[1]);
  }

  // `export { a, b as c }` / `export { a } from '...'`, skipping `export type {}`
  // and inline `type` specifiers, which are erased before the bundle runs.
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    const isTypeOnly = /^export\s+type\s*\{/.test(m[0]);
    if (isTypeOnly) continue;
    for (const spec of m[1].split(',')) {
      const name = spec.trim();
      if (!name || name.startsWith('type ')) continue;
      names.add(
        name
          .split(/\s+as\s+/)
          .pop()!
          .trim(),
      );
    }
  }

  if (/^export\s+default/m.test(src)) names.add('default');
  return names;
}

describe('assetLabel is reachable on every platform', () => {
  it('is a callable function where CardWithdrawForm imports it from', () => {
    // The form imports from the platform-neutral helper module, so this is the
    // same binding the device gets. Under jest-expo this resolves through the
    // native platform extensions, exactly as Metro does on device.
    expect(typeof assetLabel).toBe('function');
  });

  it('names the asset by symbol, falling back to a short address', () => {
    const base = {
      rainCollateralContractId: 'c1',
      chainId: 1,
      collateralProxy: '0xproxy',
      tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      decimals: 6,
      rawBalance: '1000000',
      balanceUsd: 1,
    };

    expect(assetLabel({ ...base, symbol: 'USDT' })).toBe('USDT');
    // An unreadable `symbol()` must still produce something nameable rather
    // than an empty string in the middle of a sentence.
    expect(assetLabel({ ...base, symbol: '' })).toBe('0xdAC1…1ec7');
  });

  it('is exported from every ToDestinationSelector platform variant', () => {
    // The form no longer imports it from here, but the selector modules still
    // re-export it, and a caller reaching for the old path must not get
    // `undefined` on one platform and a function on another.
    for (const file of [
      'ToDestinationSelector.tsx',
      'ToDestinationSelector.web.tsx',
      'ToDestinationSelector.native.tsx',
    ]) {
      expect(valueExports(path.join(CARD_DIR, file))).toContain('assetLabel');
    }
  });
});

describe('platform variants agree about their exports', () => {
  /** Groups every `X.native.*` / `X.web.*` pair in the app. */
  function platformGroups(): Map<string, { native?: string; web?: string }> {
    const groups = new Map<string, { native?: string; web?: string }>();
    const skip = new Set(['node_modules', '.git', 'ios', 'android', '.expo', 'dist']);

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!skip.has(entry.name)) walk(full);
          continue;
        }
        const m = entry.name.match(/^(.*?)\.(native|web)\.tsx?$/);
        if (!m) continue;
        const key = path.join(dir, m[1]);
        const group = groups.get(key) ?? {};
        group[m[2] as 'native' | 'web'] = full;
        groups.set(key, group);
      }
    };

    for (const top of ['components', 'lib', 'hooks', 'app']) {
      const dir = path.join(REPO_ROOT, top);
      if (fs.existsSync(dir)) walk(dir);
    }
    return groups;
  }

  it('exports the same value names from .native and .web siblings', () => {
    const mismatches: string[] = [];

    for (const [key, { native, web }] of platformGroups()) {
      if (!native || !web) continue; // a variant with no counterpart can't diverge
      const nativeExports = valueExports(native);
      const webExports = valueExports(web);

      const missingOnNative = [...webExports].filter(n => !nativeExports.has(n));
      const missingOnWeb = [...nativeExports].filter(n => !webExports.has(n));

      const rel = path.relative(REPO_ROOT, key);
      if (missingOnNative.length) {
        mismatches.push(`${rel}: .web exports ${missingOnNative.join(', ')} but .native does not`);
      }
      if (missingOnWeb.length) {
        mismatches.push(`${rel}: .native exports ${missingOnWeb.join(', ')} but .web does not`);
      }
    }

    // A name present on one platform and absent on the other is `undefined` at
    // runtime on that platform — a crash that no amount of type-checking or
    // web testing catches, because tsc and the web bundle both read the variant
    // that has it.
    expect(mismatches).toEqual([]);
  });
});
