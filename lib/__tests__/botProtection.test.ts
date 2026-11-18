/**
 * The native half of bot protection: an App Check token on recovery, signup and
 * account-lookup requests, and never a broken request when App Check can't
 * produce one (an older binary receiving this bundle over the air, a simulator,
 * a slow first attestation).
 */
import {
  APP_CHECK_HEADER,
  getBotProtectionHeaders,
  resetBotProtectionForTests,
} from '@/lib/botProtection';

const mockInitializeAppCheck = jest.fn();
const mockGetToken = jest.fn();

jest.mock('@react-native-firebase/app-check', () => ({
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

describe('getBotProtectionHeaders (native, App Check)', () => {
  beforeEach(() => {
    jest.useRealTimers();
    resetBotProtectionForTests();
    mockInitializeAppCheck.mockReset().mockResolvedValue({ app: 'instance' });
    mockGetToken.mockReset().mockResolvedValue({ token: 'app-check-token' });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('sends the App Check token', async () => {
    await expect(getBotProtectionHeaders()).resolves.toEqual({
      [APP_CHECK_HEADER]: 'app-check-token',
    });
    expect(mockGetToken).toHaveBeenCalledWith({ app: 'instance' }, false);
  });

  it('initializes App Check once, without background refresh', async () => {
    await getBotProtectionHeaders();
    await getBotProtectionHeaders();

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    const [, options] = mockInitializeAppCheck.mock.calls[0];
    expect(options).toMatchObject({ isTokenAutoRefreshEnabled: false });
    // Development builds can't attest; they use the debug provider.
    expect(options.provider.providerOptions.apple.provider).toBe('debug');
    expect(options.provider.providerOptions.android.provider).toBe('debug');
    // The debug token is a credential: the provider makes one per device, and
    // none is shipped in the bundle.
    expect(options.provider.providerOptions.apple).not.toHaveProperty('debugToken');
    expect(options.provider.providerOptions.android).not.toHaveProperty('debugToken');
  });

  it('sends nothing when this build has no App Check', async () => {
    mockInitializeAppCheck.mockRejectedValue(new Error('native module not found'));
    await expect(getBotProtectionHeaders()).resolves.toEqual({});
  });

  it('sends nothing when no token can be had', async () => {
    mockGetToken.mockRejectedValue(new Error('attestation failed'));
    await expect(getBotProtectionHeaders()).resolves.toEqual({});

    mockGetToken.mockResolvedValue({ token: '' });
    await expect(getBotProtectionHeaders()).resolves.toEqual({});
  });

  it('does not hold the request up when attestation hangs', async () => {
    jest.useFakeTimers();
    mockGetToken.mockReturnValue(new Promise(() => undefined));

    const headers = getBotProtectionHeaders();
    await jest.advanceTimersByTimeAsync(5_000);

    await expect(headers).resolves.toEqual({});
  });
});
