import { getVaultKey, isSolidTokenSymbol, VAULT_META } from '@/constants/withdraw';

describe('withdraw vault token symbols', () => {
  it('recognizes soUSDC as a USD vault position', () => {
    expect(isSolidTokenSymbol('soUSDC')).toBe(true);
    expect(getVaultKey('soUSDC')).toBe('USD');
  });

  it('recognizes soEURC as its own EUR vault, in any casing', () => {
    expect(isSolidTokenSymbol('soEURC')).toBe(true);
    expect(getVaultKey('soEURC')).toBe('EUR');
    expect(getVaultKey('SOEURC')).toBe('EUR');
  });

  // EURC is the asset the vault pays out, not a position to withdraw from.
  it('does not treat the underlying EURC as a vault position', () => {
    expect(isSolidTokenSymbol('EURC')).toBe(false);
    expect(getVaultKey('EURC')).toBeNull();
  });

  it('withdraws soEURC to EURC on Base in one step', () => {
    expect(VAULT_META.EUR).toEqual({
      key: 'EUR',
      displayName: 'soEURC',
      iconSymbol: 'soEURC',
      destinationSymbol: 'EURC',
      destinationNetwork: 'Base',
      requiresBridge: false,
    });
  });
});
