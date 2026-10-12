/// <reference types="jest" />

import { clampText, ERROR_COPY_LIMITS } from '@/lib/errors/copyLimits';
import { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';

describe('clampText', () => {
  beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('leaves copy that fits alone', () => {
    expect(clampText('Couldn’t move to your card', ERROR_COPY_LIMITS.toastTitle)).toBe(
      'Couldn’t move to your card',
    );
    expect(clampText(undefined, 10)).toBeUndefined();
  });

  it('cuts at a word boundary with an ellipsis, within the limit', () => {
    const long =
      'Nothing was sent. Your 50 USDC hasn’t moved. Try again in a moment, please, really.';
    const clamped = clampText(long, 48);

    expect(clamped.length).toBeLessThanOrEqual(48);
    expect(clamped.endsWith('…')).toBe(true);
    expect(clamped).toBe('Nothing was sent. Your 50 USDC hasn’t moved…');
  });

  it('hard-cuts a single long token', () => {
    expect(clampText('x'.repeat(20), 12)).toBe(`${'x'.repeat(11)}…`);
  });
});

describe('sanitizeTechnicalMessage', () => {
  it('keeps only the origin of URLs and drops keys and request dumps', () => {
    expect(
      sanitizeTechnicalMessage(
        'HTTP request failed. URL: https://eth-mainnet.g.alchemy.com/v2/AbCdEf123456 Request body: {"id":1}',
      ),
    ).toBe('HTTP request failed. URL: https://eth-mainnet.g.alchemy.com/…');
  });

  it('shortens calldata', () => {
    expect(sanitizeTechnicalMessage(`reverted 0x${'00'.repeat(100)}`)).toBe('reverted 0x00000000…');
  });
});
