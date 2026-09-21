import { ZAP_NATIVE_ASSET } from '@/lib/abis/SolidTierLockZap';
import { lockAssetFromRow, lockTokenRow, lockTokenRows } from '@/lib/lockTokenRows';
import { type LockPaymentBalances } from '@/lib/tierLockPayment';
import { TokenType } from '@/lib/types';

const FUSE_CHAIN = 122;
const WFUSE = '0x0BE9e53fd7EDaC9F859882AfdDa116645287C629';
const SOFUSE = '0xE71Cbb1eF0B0e0b0d5a0a4A0A0B0c0D0e0F00001';

const balances = (over: Partial<LockPaymentBalances> = {}): LockPaymentBalances => ({
  sofuse: 0,
  native: 0,
  wrapped: 0,
  ...over,
});

const rows = (over: Partial<Parameters<typeof lockTokenRows>[0]> = {}) =>
  lockTokenRows({
    balances: balances(),
    zapAvailable: true,
    chainId: FUSE_CHAIN,
    addresses: { wrappedNativeAddress: WFUSE, shareTokenAddress: SOFUSE },
    ...over,
  });

describe('lockTokenRows', () => {
  it('offers the three the lock can be paid with, in the picker order', () => {
    expect(rows().map(row => row.contractTickerSymbol)).toEqual(['FUSE', 'WFUSE', 'soFUSE']);
  });

  it('collapses to Savings when the zap is not deployed', () => {
    expect(rows({ zapAvailable: false }).map(row => row.contractTickerSymbol)).toEqual(['soFUSE']);
  });

  it('points each row at the contract it spends', () => {
    const [fuse, wfuse, sofuse] = rows();

    expect(fuse.contractAddress).toBe(ZAP_NATIVE_ASSET);
    expect(fuse.type).toBe(TokenType.NATIVE);
    expect(wfuse.contractAddress).toBe(WFUSE);
    expect(wfuse.type).toBe(TokenType.ERC20);
    expect(sofuse.contractAddress).toBe(SOFUSE);
  });

  /**
   * `WalletTokenList` keys and highlights on address + chain, so two rows
   * sharing a blank address would render as one and light up together — which
   * is what an environment with the contracts unset would have produced.
   */
  it('keeps the rows distinct when the backend names no addresses', () => {
    const addresses = rows({ addresses: {} }).map(row => row.contractAddress);

    expect(new Set(addresses).size).toBe(addresses.length);
    expect(addresses.every(Boolean)).toBe(true);
  });

  /**
   * The whole point of the picker: three balances the user can read against
   * one threshold. soFUSE is quoted at the FUSE the vault would return for it,
   * not at its share count.
   */
  it('quotes every balance in FUSE', () => {
    const [fuse, wfuse, sofuse] = rows({
      balances: balances({ native: 1, wrapped: 2, sofuse: 3 }),
    });

    expect(fuse.balance).toBe((10n ** 18n).toString());
    expect(wfuse.balance).toBe((2n * 10n ** 18n).toString());
    expect(sofuse.balance).toBe((3n * 10n ** 18n).toString());
    expect(new Set([fuse, wfuse, sofuse].map(row => row.contractDecimals))).toEqual(new Set([18]));
  });

  /** One rate across all three, so the dollar column ranks them as FUSE does. */
  it('prices all three off the FUSE spot', () => {
    expect(rows({ fusePriceUsd: 0.042 }).every(row => row.quoteRate === 0.042)).toBe(true);
  });

  /** The chip on the upgrade step has no dollar column to fill. */
  it('defaults to no price for a row built without one', () => {
    expect(
      lockTokenRow({
        asset: 'FUSE',
        balances: balances({ native: 5 }),
        chainId: FUSE_CHAIN,
        addresses: {},
      }).quoteRate,
    ).toBe(0);
  });
});

describe('lockAssetFromRow', () => {
  it('reads back the asset a row was built from', () => {
    expect(rows().map(lockAssetFromRow)).toEqual(['FUSE', 'WFUSE', 'soFUSE']);
  });

  it('does not claim a token that is not one of the three', () => {
    expect(lockAssetFromRow({ ...rows()[0], contractTickerSymbol: 'USDC' })).toBeUndefined();
  });
});
