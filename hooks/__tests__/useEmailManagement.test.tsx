import React from 'react';
import { Alert } from 'react-native';

import { EMAIL_CHANGE_STEP_UP_REQUIRED_CODE } from '@/constants/errors';
import { useEmailManagement } from '@/hooks/useEmailManagement';
import { confirmEmailChange, initGenericOtp, verifyGenericOtp } from '@/lib/api';
import { showErrorToast } from '@/lib/errors';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockStampUpdateUserEmail = jest.fn();
const mockUpdateUserEmail = jest.fn();

jest.mock('@turnkey/react-native-wallet-kit', () => ({
  StamperType: { Passkey: 'passkey', ApiKey: 'api-key' },
  useTurnkey: () => ({
    createHttpClient: () => ({
      stampUpdateUserEmail: mockStampUpdateUserEmail,
      updateUserEmail: mockUpdateUserEmail,
    }),
  }),
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({
    user: {
      userId: 'user-1',
      turnkeyUserId: 'tk-user-1',
      suborgId: 'suborg-1',
      email: 'old@example.com',
    },
  }),
}));
jest.mock('@/lib/api', () => ({
  initGenericOtp: jest.fn(),
  verifyGenericOtp: jest.fn(),
  confirmEmailChange: jest.fn(),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/errors', () => ({
  sanitizeTechnicalMessage: (value: unknown) => String(value),
  showErrorToast: jest.fn(),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (select: (state: { updateUser: jest.Mock }) => unknown) =>
    select({ updateUser: jest.fn() }),
}));

const mockInit = initGenericOtp as jest.MockedFunction<typeof initGenericOtp>;
const mockVerify = verifyGenericOtp as jest.MockedFunction<typeof verifyGenericOtp>;
const mockConfirm = confirmEmailChange as jest.MockedFunction<typeof confirmEmailChange>;
const mockToast = showErrorToast as jest.MockedFunction<typeof showErrorToast>;

const NEW_EMAIL = 'new@example.com';
const SIGNED = {
  url: 'https://api.turnkey.com/public/v1/submit/update_user_email',
  body: '{}',
  stamp: { stampHeaderName: 'X-Stamp-WebAuthn', stampHeaderValue: '{}' },
};

type Result = ReturnType<typeof useEmailManagement>;

/** Render the hook and hand back its latest value. */
const renderHook = async (): Promise<() => Result> => {
  const seen: Result[] = [];
  const Probe = () => {
    seen.push(useEmailManagement(undefined, 'email'));
    return null;
  };
  await act(async () => {
    create(<Probe />);
  });
  return () => seen[seen.length - 1];
};

/** Request a code for the new address and land on the code step. */
const requestCode = async (latest: () => Result) => {
  await act(async () => {
    await latest().handleSendOtp({ email: NEW_EMAIL });
  });
};

const submitCode = async (latest: () => Result) => {
  await act(async () => {
    // What the user typed stays in the field, as it does on screen.
    latest().otpForm.setValue('otpCode', '123456');
    await latest().handleVerifyOtp({ otpCode: '123456' });
  });
};

/**
 * SEC-010: a verified code no longer changes the email. The account's passkey
 * signs Turnkey's UPDATE_USER_EMAIL and the backend relays it before saving.
 */
describe('useEmailManagement — passkey-confirmed email change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockInit.mockResolvedValue({ otpId: 'otp-1' });
    mockVerify.mockResolvedValue({
      success: true,
      stepUpRequired: true,
      verificationToken: 'vt-1',
    });
    mockStampUpdateUserEmail.mockResolvedValue(SIGNED);
    mockConfirm.mockResolvedValue({
      success: true,
      email: NEW_EMAIL,
      recoveryEmailHoldUntil: '2026-11-10T12:00:00.000Z',
    });
  });

  it('signs the change with the passkey and sends it to the backend, not Turnkey', async () => {
    const latest = await renderHook();
    await requestCode(latest);
    await submitCode(latest);

    expect(mockStampUpdateUserEmail).toHaveBeenCalledWith(
      {
        userId: 'tk-user-1',
        userEmail: NEW_EMAIL,
        organizationId: 'suborg-1',
        verificationToken: 'vt-1',
      },
      'passkey',
    );
    expect(mockConfirm).toHaveBeenCalledWith('otp-1', SIGNED);
    // The request is only ever submitted through the backend's relay.
    expect(mockUpdateUserEmail).not.toHaveBeenCalled();
    expect(latest().step).toBe('success');
    expect(latest().recoveryAvailableAt?.toISOString()).toBe('2026-11-10T12:00:00.000Z');
  });

  it('retries only the passkey after a failed prompt, without spending a new code', async () => {
    mockStampUpdateUserEmail.mockRejectedValueOnce(new Error('NotAllowedError'));
    const latest = await renderHook();
    await requestCode(latest);

    await submitCode(latest);
    expect(latest().step).toBe('otp');
    expect(latest().awaitingPasskey).toBe(true);
    expect(latest().getButtonText()).toBe('Confirm with Passkey');

    await submitCode(latest);

    // The code verified once; it is spent, so it is not sent again.
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(latest().step).toBe('success');
  });

  it('starts over when the backend says the confirmation expired', async () => {
    mockConfirm.mockRejectedValueOnce({
      statusCode: 403,
      code: EMAIL_CHANGE_STEP_UP_REQUIRED_CODE,
      message: 'This confirmation has expired or was already used.',
    });
    const latest = await renderHook();
    await requestCode(latest);

    await submitCode(latest);
    expect(latest().awaitingPasskey).toBe(false);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ code: EMAIL_CHANGE_STEP_UP_REQUIRED_CODE }),
      expect.objectContaining({ title: 'Couldn’t confirm with your passkey' }),
    );
  });

  it('keeps working against a backend that saves on verify', async () => {
    mockVerify.mockResolvedValue({ success: true, verificationToken: 'vt-1' });
    const latest = await renderHook();
    await requestCode(latest);
    await submitCode(latest);

    expect(mockUpdateUserEmail).toHaveBeenCalledWith(
      expect.objectContaining({ userEmail: NEW_EMAIL, verificationToken: 'vt-1' }),
    );
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(latest().step).toBe('success');
    expect(latest().recoveryAvailableAt).toBeNull();
  });

  it('a new code discards the confirmation an old one left waiting', async () => {
    mockStampUpdateUserEmail.mockRejectedValueOnce(new Error('NotAllowedError'));
    const latest = await renderHook();
    await requestCode(latest);
    await submitCode(latest);
    expect(latest().awaitingPasskey).toBe(true);

    mockInit.mockResolvedValue({ otpId: 'otp-2' });
    await requestCode(latest);
    await submitCode(latest);

    expect(mockVerify).toHaveBeenCalledTimes(2);
    expect(mockVerify).toHaveBeenLastCalledWith('otp-2', '123456', NEW_EMAIL);
    expect(mockConfirm).toHaveBeenLastCalledWith('otp-2', SIGNED);
  });
});
