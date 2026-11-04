import { isOwnSafe } from '@/lib/deposit/externalWallet';

const SAFE = '0x4d22bE2509C4c0B7902BF542E1460c6cE1f210f7';

describe('isOwnSafe', () => {
  it('accepts the user’s own Safe in any casing', () => {
    expect(isOwnSafe(SAFE.toLowerCase(), SAFE)).toBe(true);
  });

  it('refuses a connected external wallet', () => {
    expect(isOwnSafe('0x1111111111111111111111111111111111111111', SAFE)).toBe(false);
  });

  it('refuses when either address is missing', () => {
    expect(isOwnSafe(undefined, SAFE)).toBe(false);
    expect(isOwnSafe(SAFE, undefined)).toBe(false);
  });
});
