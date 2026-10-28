import { LifiSwapApiError } from '@/lib/api/lifi-swap';
import { swapErrorButtonLabel, swapErrorCodeOf, swapErrorCopy } from '@/lib/swapErrors';

jest.mock('@/lib/api', () => ({ getJWTToken: () => undefined, getPlatformHeaders: () => ({}) }));
jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_FLASH_API_BASE_URL: 'https://api.test' }));

describe('the swap errors table', () => {
  it('reads the backend’s code', () => {
    expect(swapErrorCodeOf(new LifiSwapApiError(422, 'No route found', 'NO_ROUTE'))).toBe(
      'NO_ROUTE',
    );
    expect(swapErrorCodeOf(new LifiSwapApiError(422, 'Too small', 'AMOUNT_TOO_LOW'))).toBe(
      'AMOUNT_TOO_LOW',
    );
  });

  it('reads an older backend by status', () => {
    expect(swapErrorCodeOf(new LifiSwapApiError(422, 'No route found for this swap.'))).toBe(
      'NO_ROUTE',
    );
    expect(swapErrorCodeOf(new LifiSwapApiError(503, 'busy'))).toBe('QUOTES_BUSY');
    expect(swapErrorCodeOf(new LifiSwapApiError(400, 'Invalid fromAddress'))).toBe(
      'QUOTE_UNAVAILABLE',
    );
    expect(swapErrorCodeOf(new Error('network down'))).toBe('QUOTE_UNAVAILABLE');
  });

  it('never shows the backend’s sentence, even for a code it doesn’t know', () => {
    const error = new LifiSwapApiError(400, 'Token 0xabc is not available', 'SOMETHING_NEW');
    expect(swapErrorCopy(swapErrorCodeOf(error))).not.toContain('0xabc');
  });

  it('suggests USDC as the way round a missing route, unless USDC is one side', () => {
    expect(swapErrorCopy('NO_ROUTE', { from: 'FUSE', to: 'EURC' })).toBe(
      'We can’t swap FUSE to EURC right now. Swap it to USDC first, or try another coin.',
    );
    expect(swapErrorCopy('NO_ROUTE', { from: 'USDC', to: 'EURC' })).toBe(
      'We can’t swap USDC to EURC right now. Try another coin.',
    );
  });

  it('names the pair’s minimum when it has one', () => {
    expect(swapErrorCopy('AMOUNT_TOO_LOW', { from: 'USDC', minAmount: '5' })).toBe(
      'The smallest amount for this swap is 5 USDC.',
    );
    expect(swapErrorCopy('AMOUNT_TOO_LOW')).toBe(
      'That amount is too small to swap. Try a larger amount.',
    );
  });

  it('gives the button a few words', () => {
    expect(swapErrorButtonLabel('NOT_ENOUGH_BALANCE', { from: 'USD Yield' })).toBe(
      'Not enough USD Yield',
    );
    expect(swapErrorButtonLabel('NO_ROUTE')).toBe('Pick another coin');
  });

  it('keeps the code and its details from the response body', async () => {
    const { fetchLifiSwapQuote } = jest.requireActual('@/lib/api/lifi-swap');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        statusCode: 422,
        code: 'AMOUNT_TOO_LOW',
        message: 'The smallest amount for this swap is $1.',
        minFromAmount: '1000000',
      }),
    }) as never;
    await expect(
      fetchLifiSwapQuote({
        fromChain: 8453,
        toChain: 8453,
        fromToken: '0x1',
        toToken: '0x2',
        fromAmount: '1',
      }),
    ).rejects.toMatchObject({
      code: 'AMOUNT_TOO_LOW',
      details: { minFromAmount: '1000000' },
    });
  });
});
