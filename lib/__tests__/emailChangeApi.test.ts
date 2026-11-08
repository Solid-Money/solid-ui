import { confirmEmailChange, verifyGenericOtp } from '@/lib/api';

jest.mock('@/constants/rewards', () => ({ MOCK_REWARDS_USER_DATA: {}, MOCK_TIER_BENEFITS: {} }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({ users: [] }) } }));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const axios = { ...instance, create: () => instance };
  return { __esModule: true, default: axios, ...axios };
});

const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

/** The JSON body of the one request made. */
const sentBody = () => {
  const [, init] = mockFetch.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
};

/**
 * SEC-010: the backend refuses to verify an email-change code for an app that
 * cannot finish the change with a passkey, so this build has to say it can.
 */
describe('email change requests', () => {
  it('declares that this build confirms the change with a passkey', async () => {
    await verifyGenericOtp('otp-1', '123456', 'new@example.com');

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/accounts\/v1\/auths\/verify-generic-otp$/);
    expect(sentBody()).toEqual({
      otpId: 'otp-1',
      otpCode: '123456',
      email: 'new@example.com',
      supportsPasskeyConfirmation: true,
    });
  });

  it('sends the passkey-signed request to the backend verbatim', async () => {
    const signedRequest = {
      url: 'https://api.turnkey.com/public/v1/submit/update_user_email',
      body: '{"type":"ACTIVITY_TYPE_UPDATE_USER_EMAIL"}',
      stamp: { stampHeaderName: 'X-Stamp-WebAuthn', stampHeaderValue: '{}' },
    };

    await confirmEmailChange('otp-1', signedRequest);

    expect(mockFetch.mock.calls[0][0]).toMatch(/\/accounts\/v1\/auths\/confirm-email-change$/);
    expect(sentBody()).toEqual({ otpId: 'otp-1', signedRequest });
  });

  it('throws the backend error body, so its code reaches the caller', async () => {
    const body = { statusCode: 403, code: 'EMAIL_CHANGE_STEP_UP_REQUIRED', message: 'No' };
    mockFetch.mockResolvedValue({ ok: false, status: 403, json: async () => body });

    await expect(
      confirmEmailChange('otp-1', {
        url: 'u',
        body: 'b',
        stamp: { stampHeaderName: 'X-Stamp-WebAuthn', stampHeaderValue: '{}' },
      }),
    ).rejects.toEqual(body);
  });
});
