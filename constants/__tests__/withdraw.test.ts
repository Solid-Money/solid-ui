import { getVaultKey, isSolidTokenSymbol } from '@/constants/withdraw';

describe('withdraw vault token symbols', () => {
  it('recognizes soUSDC as a USD vault position', () => {
    expect(isSolidTokenSymbol('soUSDC')).toBe(true);
    expect(getVaultKey('soUSDC')).toBe('USD');
  });
});
