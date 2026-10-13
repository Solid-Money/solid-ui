import {
  formatShareRate,
  formatYieldUsd,
  openYieldProduct,
  YIELD_PRODUCT_ORDER,
  yieldProductName,
} from '@/components/Earn/yieldProducts';
import { VaultType } from '@/lib/types';

describe('yield products', () => {
  it('names each product, never its share token', () => {
    expect(YIELD_PRODUCT_ORDER.map(yieldProductName)).toEqual([
      'USD Yield',
      'ETH Yield',
      'FUSE Yield',
    ]);
  });

  it('prices a share in what the product is worth in', () => {
    expect(formatShareRate(VaultType.USDC, 1.083021)).toBe('1 soUSD = $1.0830');
    expect(formatShareRate(VaultType.ETH, 1.0123)).toBe('1 soETH = 1.0123 ETH');
    expect(formatShareRate(VaultType.FUSE, 1.2)).toBe('1 soFUSE = 1.2000 FUSE');
  });

  it('shows no rate rather than a made-up one', () => {
    expect(formatShareRate(VaultType.USDC, undefined)).toBeUndefined();
    expect(formatShareRate(VaultType.USDC, 0)).toBeUndefined();
    expect(formatShareRate(VaultType.USDC, Number.NaN)).toBeUndefined();
  });

  it('opens the product page for its vault', () => {
    expect(openYieldProduct(VaultType.ETH)).toEqual({
      pathname: '/savings',
      params: { vault: 'eth' },
    });
  });

  it('writes dollars to the cent, even under a dollar', () => {
    expect(formatYieldUsd(0.1)).toBe('$0.10');
    expect(formatYieldUsd(9.244)).toBe('$9.24');
    expect(formatYieldUsd(2560)).toBe('$2,560.00');
    expect(formatYieldUsd(0.004)).toBe('<$0.01');
    expect(formatYieldUsd(0)).toBe('$0.00');
    expect(formatYieldUsd(undefined)).toBe('—');
  });
});
