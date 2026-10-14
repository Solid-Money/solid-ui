/// <reference types="jest" />
import { isVaultType } from '@/components/Savings/NewSavings/vaultDeepLink';
import { VaultType } from '@/lib/types';

/**
 * The rewards "Add FUSE to your savings" CTA deep-links to
 * `/savings?vault=fuse`. The param is user-controllable, so anything that isn't
 * a real vault has to fall through to the USDC default rather than seeding
 * state with a value the screen can't render.
 */
describe('isVaultType', () => {
  it('accepts every vault we actually have', () => {
    expect(isVaultType('fuse')).toBe(true);
    expect(isVaultType('usdc')).toBe(true);
    expect(isVaultType('eth')).toBe(true);
    expect(isVaultType(VaultType.FUSE)).toBe(true);
    // jest runs as a QA/preview build, where the EUR vault is listed.
    expect(isVaultType('eur')).toBe(true);
  });

  // soEURC is a VaultType in every build but listed on QA/preview only, so a
  // production `/savings?vault=eur` must fall through to the USD vault.
  it('rejects a vault type this build does not list', () => {
    const productionVaults = [VaultType.USDC, VaultType.FUSE, VaultType.ETH].map(type => ({
      type,
    }));
    expect(isVaultType('eur', productionVaults)).toBe(false);
    expect(isVaultType('usdc', productionVaults)).toBe(true);
  });

  it('rejects a missing param', () => {
    expect(isVaultType(undefined)).toBe(false);
    expect(isVaultType('')).toBe(false);
  });

  it('rejects unknown or wrongly-cased values', () => {
    expect(isVaultType('FUSE')).toBe(false);
    expect(isVaultType('doge')).toBe(false);
    expect(isVaultType('__proto__')).toBe(false);
  });
});
