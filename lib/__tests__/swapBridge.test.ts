import { CrossChainSendApiError } from '@/lib/api/cross-chain-send';
import { bridgeAmount, bridgeQuoteError, bridgeToAmount } from '@/lib/swapBridge';

jest.mock('@/lib/api', () => ({ getJWTToken: jest.fn(), getPlatformHeaders: () => ({}) }));
jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://api.test' }));

describe('bridgeAmount', () => {
  it('reads a quote in the decimals of the coin sent', () => {
    expect(bridgeAmount('4940000', { decimals: 6 }, 6)).toBe(4.94);
    // BNB Chain's USDC has 18.
    expect(bridgeAmount('4940000000000000000', { decimals: 18 }, 6)).toBe(4.94);
  });

  it('falls back to the paying coin’s decimals for a backend that doesn’t send them', () => {
    expect(bridgeAmount('4940000', {}, 6)).toBe(4.94);
  });
});

describe('bridgeToAmount', () => {
  it('is what lands when the bridge delivers the coin asked for', () => {
    expect(bridgeToAmount(4.94, { thenSwap: false, landsAsPrice: 1, toPrice: 0 })).toBe(4.94);
  });

  it('estimates the coin a swap on Fuse makes of it, at today’s prices', () => {
    expect(bridgeToAmount(5, { thenSwap: true, landsAsPrice: 1, toPrice: 0.025 })).toBe(200);
  });

  it('has no estimate without both prices', () => {
    expect(bridgeToAmount(5, { thenSwap: true, landsAsPrice: 1, toPrice: 0 })).toBeUndefined();
    expect(bridgeToAmount(5, { thenSwap: true, landsAsPrice: 0, toPrice: 1 })).toBeUndefined();
  });
});

describe('bridgeQuoteError', () => {
  const refused = (status: number, message: string) => new CrossChainSendApiError(status, message);

  it('shows the backend’s own words for an amount out of bounds', () => {
    expect(bridgeQuoteError(refused(400, 'Minimum is 5 USDC from Base'))).toEqual({
      code: 'AMOUNT_TOO_LOW',
      copy: 'Minimum is 5 USDC from Base.',
    });
    expect(
      bridgeQuoteError(refused(400, 'Amount too small to cover the 0.31 USDC network fee')).code,
    ).toBe('AMOUNT_TOO_LOW');
    expect(bridgeQuoteError(refused(400, 'Maximum is 10,000 USDC per send')).code).toBe(
      'AMOUNT_TOO_HIGH',
    );
    expect(bridgeQuoteError(refused(400, 'Up to 812.5 USDC right now on Base')).code).toBe(
      'AMOUNT_TOO_HIGH',
    );
  });

  it('says when moving between networks is paused', () => {
    expect(bridgeQuoteError(refused(503, 'Cross-chain sends are paused'))).toEqual({
      code: 'QUOTE_UNAVAILABLE',
      copy: 'Moving coins between networks is paused right now. Try again later.',
    });
    expect(
      bridgeQuoteError(refused(503, 'USDC from Base to Fuse is temporarily unavailable')).copy,
    ).toBe('USDC from Base to Fuse is temporarily unavailable.');
  });

  it('falls back to the generic copy for anything else', () => {
    expect(bridgeQuoteError(new Error('network down'))).toEqual({
      code: 'QUOTE_UNAVAILABLE',
      copy: 'We couldn’t get a price. Try again in a moment.',
    });
  });
});
