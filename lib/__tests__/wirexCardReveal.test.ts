/// <reference types="jest" />
import { revealWirexCardWithSession } from '@/lib/utils/wirexCardReveal';

const WALLET = '0xaB2c32046543b71c84B0C816BeE7831ADC603C89';
const CARD_ID = '9cc695f3-21b6-4f2d-a44c-a1473e6e8527';
const API = 'https://api-baas.wirexapp.tech';
const SIGNATURE = '0xdeadbeef';

const session = {
  accessToken: 'wirex-user-token',
  expiresAt: 1_800_000_000,
  apiBaseUrl: API,
  chainId: '8453',
  cardId: CARD_ID,
  walletAddress: WALLET,
  actionType: 'GetCardDetails',
  messageTemplate: 'By signing this I confirm that I am executing action GetCardDetails at {nonce}',
};

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

/** Route each call by URL so assertions do not depend on call ordering. */
const routeFetch = (overrides: Partial<Record<'confirm' | 'details' | 'cvv', Response>> = {}) =>
  jest.fn(async (url: string, _init?: RequestInit) => {
    if (url.includes('/confirmation/signature/verify')) {
      return overrides.confirm ?? jsonResponse({ action_token: 'action-token-1' });
    }
    if (url.endsWith('/details')) {
      return (
        overrides.details ??
        jsonResponse({ card_number: '4111111111111111', expiry_date: '12/2027' })
      );
    }
    if (url.endsWith('/cvv')) {
      return overrides.cvv ?? jsonResponse({ cvv: '123' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

type FetchCall = [string, RequestInit?];

const callTo = (fetchMock: jest.Mock, match: (url: string) => boolean): FetchCall => {
  const call = (fetchMock.mock.calls as FetchCall[]).find(([url]) => match(url));
  if (!call) throw new Error('expected a matching fetch call');
  return call;
};

const bodyOf = (call: FetchCall): Record<string, unknown> =>
  JSON.parse(String(call[1]?.body ?? '{}'));

const headersOf = (call: FetchCall): Record<string, string> =>
  (call[1]?.headers ?? {}) as Record<string, string>;

/**
 * Wirex releases card data only after the user confirms with a wallet signature,
 * and requires the read to happen client-side (proxying cardholder data through a
 * non-PCI-compliant backend is not permitted). These tests pin that contract:
 * the exact message signed, and that PAN/CVV are fetched straight from Wirex.
 */
describe('revealWirexCardWithSession', () => {
  let signMessage: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-12T00:00:00.000Z'));
    signMessage = jest.fn().mockResolvedValue(SIGNATURE);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const run = (fetchMock: jest.Mock) => {
    global.fetch = fetchMock as unknown as typeof fetch;
    return revealWirexCardWithSession(session, signMessage);
  };

  it('returns the PAN, expiry and CVV read from Wirex', async () => {
    await expect(run(routeFetch())).resolves.toEqual({
      card_number: '4111111111111111',
      card_security_code: '123',
      expiry_date: '12/2027',
    });
  });

  it('signs exactly the message Wirex specifies, with a fresh nonce', async () => {
    await run(routeFetch());

    const nonce = Math.floor(new Date('2026-08-12T00:00:00.000Z').getTime() / 1000);
    // One character of drift here and Wirex answers `signature: invalid_signature`.
    expect(signMessage).toHaveBeenCalledWith(
      `By signing this I confirm that I am executing action GetCardDetails at ${nonce}`,
    );
  });

  it('sends the signature and the same nonce it signed', async () => {
    const fetchMock = routeFetch();
    await run(fetchMock);

    const body = bodyOf(callTo(fetchMock, url => url.includes('/confirmation/signature/verify')));
    const signedNonce = Number(/at (\d+)$/.exec(String(signMessage.mock.calls[0][0]))![1]);

    expect(body).toEqual({
      action_type: 'GetCardDetails',
      message_signature: SIGNATURE,
      nonce: signedNonce,
    });
  });

  it('reads the card data directly from Wirex', async () => {
    const fetchMock = routeFetch();
    await run(fetchMock);

    const secretCalls = (fetchMock.mock.calls as FetchCall[])
      .map(([url]) => url)
      .filter(url => url.endsWith('/details') || url.endsWith('/cvv'));

    expect(secretCalls).toEqual([
      `${API}/api/v1/cards/${CARD_ID}/details`,
      `${API}/api/v1/cards/${CARD_ID}/cvv`,
    ]);
  });

  it('authenticates to Wirex with the user token and the card’s own wallet', async () => {
    const fetchMock = routeFetch();
    await run(fetchMock);

    expect(headersOf(callTo(fetchMock, url => url.endsWith('/details')))).toMatchObject({
      Authorization: 'Bearer wirex-user-token',
      'X-Chain-Id': '8453',
      'X-User-Wallet': WALLET,
    });
  });

  it('reuses one action token across both reads, so the user signs once', async () => {
    const fetchMock = routeFetch();
    await run(fetchMock);

    const tokens = (fetchMock.mock.calls as FetchCall[])
      .filter(([url]) => url.endsWith('/details') || url.endsWith('/cvv'))
      .map(call => bodyOf(call).action_token);

    expect(tokens).toEqual(['action-token-1', 'action-token-1']);
    expect(signMessage).toHaveBeenCalledTimes(1);
  });

  it('still returns the PAN when only the CVV read fails', async () => {
    // A card is less useful without its CVV, but a PAN beats failing outright.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await run(
      routeFetch({ cvv: jsonResponse({ error_description: 'nope' }, false, 500) }),
    );

    expect(result.card_number).toBe('4111111111111111');
    expect(result.card_security_code).toBe('');
  });

  describe('error reporting', () => {
    it('surfaces the reason Wirex hides in error_details', async () => {
      // error_description stays generic, so without unpacking error_details every
      // failure looks the same.
      await expect(
        run(
          routeFetch({
            confirm: jsonResponse(
              {
                error_description: 'Request failed validation',
                error_details: [{ key: 'signature', details: 'invalid_signature' }],
              },
              false,
              400,
            ),
          }),
        ),
      ).rejects.toThrow('Request failed validation (signature: invalid_signature)');
    });

    it('reports an expired nonce distinctly', async () => {
      await expect(
        run(
          routeFetch({
            confirm: jsonResponse(
              {
                error_description: 'Request failed validation',
                error_details: [{ key: 'nonce', details: 'expired' }],
              },
              false,
              400,
            ),
          }),
        ),
      ).rejects.toThrow('nonce: expired');
    });

    it('reports a card that is not active', async () => {
      await expect(
        run(
          routeFetch({
            details: jsonResponse(
              {
                error_description: 'Invalid card status',
                error_details: [{ key: 'card_status', details: 'not_active' }],
              },
              false,
              400,
            ),
          }),
        ),
      ).rejects.toThrow('card_status: not_active');
    });

    it('fails when Wirex returns no action token', async () => {
      await expect(run(routeFetch({ confirm: jsonResponse({}) }))).rejects.toThrow(
        'did not return a confirmation token',
      );
    });

    it('does not attempt a read when the user declines to sign', async () => {
      signMessage.mockRejectedValue(new Error('User cancelled'));
      const fetchMock = routeFetch();

      await expect(run(fetchMock)).rejects.toThrow('User cancelled');

      const reads = (fetchMock.mock.calls as FetchCall[]).filter(([url]) =>
        url.includes('/api/v1/cards/'),
      );
      expect(reads).toHaveLength(0);
    });
  });
});
