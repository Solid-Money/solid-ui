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

  it('keeps the server’s Details line from after the request dump', () => {
    // The Oct 14 Ethereum swap failure, as viem built it (key swapped out).
    const message = [
      'Invalid parameters were provided to the RPC method.',
      'Double check you have provided the correct parameters.',
      '',
      'URL: https://api.pimlico.io/v2/1/rpc?apikey=pim_TestKey1234567890abc',
      `Request body: {"method":"pm_getPaymasterData","params":[{"callData":"0x541d63c8${'00'.repeat(64)}"},"0x0000000071727De22E5E9d8BAf0edAc6f37da032","0x1",{"sponsorshipPolicyId":"sp_test"}]}`,
      '',
      'Details: sponsorshipPolicy perOpMaximumUsd reached',
      'Version: viem@2.47.10',
    ].join('\n');

    const out = sanitizeTechnicalMessage(message);
    expect(out).toBe(
      'Invalid parameters were provided to the RPC method. Double check you have provided the correct parameters. URL: https://api.pimlico.io/… Details: sponsorshipPolicy perOpMaximumUsd reached',
    );
    expect(out).not.toContain('pim_');
    expect(out).not.toContain('callData');
  });

  it('redacts a key that turns up in the Details line itself', () => {
    const out = sanitizeTechnicalMessage(
      'RPC Request failed.\n\nRequest body: {"id":1}\n\nDetails: bad key apikey=pim_TestKey1234567890abc',
    );
    expect(out).toBe('RPC Request failed. Details: bad key apikey=[redacted]');
  });
});
