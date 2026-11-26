import { fuse } from 'viem/chains';

import { ADDRESSES, PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { SOBTC_ADDRESSES } from '@/lib/soBtc';
import { isEarnShareToken } from '@/lib/vaults';

// `constants/vaults` reaches `lib/wagmi` through `lib/soBtc`, and wagmi ships ESM
// only. Nothing here reads a chain.
jest.mock('@/lib/wagmi', () => ({}));

/**
 * Moving any of these takes money out of Earn, so the send and swap forms warn
 * about a tier held on the "Hold in Earn" route — on every chain the shares sit
 * on, not just Fuse.
 */
describe('isEarnShareToken', () => {
  it.each([
    ['soUSD on Fuse', PRODUCTION_VAULT_ADDRESSES.fuse.vault],
    ['soUSD on Ethereum', PRODUCTION_VAULT_ADDRESSES.ethereum.vault],
    ['soUSD on Base', PRODUCTION_VAULT_ADDRESSES.base.vault],
    ['soFUSE', PRODUCTION_VAULT_ADDRESSES.fuse.fuseVault],
    ['soETH on Fuse', PRODUCTION_VAULT_ADDRESSES.fuse.soEthVault],
    ['soETH on Ethereum', PRODUCTION_VAULT_ADDRESSES.ethereum.soEthVault],
    ['soETH on Base', PRODUCTION_VAULT_ADDRESSES.base.soEthVault],
    ['soEURC on Base', PRODUCTION_VAULT_ADDRESSES.base.soEurcVault],
    ['soBTC on Base', SOBTC_ADDRESSES.base.vault],
    ['soBTC on Ethereum', SOBTC_ADDRESSES.ethereum.vault],
    ["this build's soUSD on Fuse", ADDRESSES.fuse.vault],
    ["this build's soFUSE", ADDRESSES.fuse.fuseVault],
    ["this build's soEURC on Base", ADDRESSES.base.soEurcVault],
  ])('recognizes %s, in any letter case', (_name, address) => {
    expect(isEarnShareToken(address)).toBe(true);
    expect(isEarnShareToken(address.toLowerCase())).toBe(true);
    expect(isEarnShareToken(`0x${address.slice(2).toUpperCase()}`)).toBe(true);
  });

  it('does not take a coin, a copied ticker or nothing for a share', () => {
    expect(isEarnShareToken(ADDRESSES.ethereum.usdc)).toBe(false);
    expect(isEarnShareToken(ADDRESSES.base.usdc)).toBe(false);
    // A token that only calls itself soUSD.
    expect(isEarnShareToken(`0xsoUSD${fuse.id}`)).toBe(false);
    expect(isEarnShareToken('0x0000000000000000000000000000000000000000')).toBe(false);
    expect(isEarnShareToken(undefined)).toBe(false);
    expect(isEarnShareToken('')).toBe(false);
  });
});
