import { CardCollateralTokenBalanceDto } from '@/lib/types';
import { isDifferentCollateralAsset, withdrawableAssetOptions } from '@/lib/utils/cardHelpers';

/**
 * The asset picker on "Withdraw from card", as a support recording found it.
 *
 * The cardholder's Rain contracts hold $30.04 of USDC and $5.01 of USDT, and the
 * backend lists every token those contracts support — so the picker offered ten
 * rows, eight of them $0, including a second "USDC" and a second "USDT" at $0
 * beside the funded pair. Picking a $0 row can only produce "No USDC is available
 * to withdraw right now", and picking the funded one wiped the amount the user had
 * just set with Max.
 */

const asset = (
  overrides: Partial<CardCollateralTokenBalanceDto> & Pick<CardCollateralTokenBalanceDto, 'symbol'>,
): CardCollateralTokenBalanceDto => ({
  rainCollateralContractId: 'c1',
  chainId: 8453,
  collateralProxy: '0xproxy',
  tokenAddress: `0x${overrides.symbol}${overrides.chainId ?? 8453}`,
  decimals: 6,
  rawBalance: '0',
  balanceUsd: 0,
  ...overrides,
});

const USDC_FUNDED = asset({ symbol: 'USDC', tokenAddress: '0xusdc', balanceUsd: 30.04 });
const USDT_FUNDED = asset({ symbol: 'USDT', tokenAddress: '0xusdt', balanceUsd: 5.01 });
const EMPTY_ASSETS = [
  asset({ symbol: 'USDC', tokenAddress: '0xusdc2', chainId: 42161 }),
  asset({ symbol: 'USDT', tokenAddress: '0xusdt2', chainId: 42161 }),
  asset({ symbol: 'DAI', tokenAddress: '0xdai' }),
  asset({ symbol: 'rUSD', tokenAddress: '0xrusd' }),
];

describe('withdrawableAssetOptions', () => {
  it('offers only the assets the card actually holds', () => {
    const options = withdrawableAssetOptions([USDC_FUNDED, USDT_FUNDED, ...EMPTY_ASSETS]);

    expect(options).toEqual([USDC_FUNDED, USDT_FUNDED]);
  });

  it('keeps the backend order, so the richest asset stays first', () => {
    const options = withdrawableAssetOptions([USDT_FUNDED, USDC_FUNDED]);

    expect(options.map(option => option.symbol)).toEqual(['USDT', 'USDC']);
  });

  it('drops an asset whose balance could not be read', () => {
    // `balanceUsd` is 0 for those and does not mean empty, so quoting it as a
    // withdrawable figure would be a number we do not have.
    const unreadable = asset({
      symbol: 'USDC',
      tokenAddress: '0xunreadable',
      unavailableReason: 'RPC error',
    });

    expect(withdrawableAssetOptions([USDC_FUNDED, unreadable])).toEqual([USDC_FUNDED]);
  });

  it('keeps the selected asset even once it is empty', () => {
    // Otherwise the list cannot show what the trigger says is selected.
    const drained = asset({ symbol: 'USDT', tokenAddress: '0xusdt' });

    expect(withdrawableAssetOptions([USDC_FUNDED, drained], '0xUSDT')).toEqual([
      USDC_FUNDED,
      drained,
    ]);
  });

  it('falls back to every readable asset when the card holds nothing', () => {
    // An empty picker offers no way out of itself, and the user still has to see
    // what the card supports.
    expect(withdrawableAssetOptions(EMPTY_ASSETS)).toEqual(EMPTY_ASSETS);
  });

  it('answers with an empty list for a card with no collateral response', () => {
    expect(withdrawableAssetOptions(undefined)).toEqual([]);
  });
});

describe('isDifferentCollateralAsset', () => {
  it('is false when the user re-picks the asset already selected', () => {
    // The row they tap is the one the trigger names. Treating that as a change
    // cleared the amount they had just set with Max.
    expect(isDifferentCollateralAsset(USDC_FUNDED, '0xusdc')).toBe(false);
  });

  it('ignores address casing, which differs between our sources', () => {
    expect(isDifferentCollateralAsset(USDC_FUNDED, '0xUSDC')).toBe(false);
  });

  it('is true when the pick moves to another asset', () => {
    expect(isDifferentCollateralAsset(USDT_FUNDED, '0xusdc')).toBe(true);
  });

  it('is true when nothing is selected yet', () => {
    expect(isDifferentCollateralAsset(USDC_FUNDED, undefined)).toBe(true);
  });
});
