import React from 'react';
import Toast from 'react-native-toast-message';

import OnboardingNew from '@/components/Onboarding/NewOnboarding/OnboardingNew';
import { PASSKEY_ACCOUNT_NOT_FOUND_CODE, PASSKEY_UNLINKED_MESSAGE } from '@/constants/errors';
import { path } from '@/constants/path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * Props the last render handed each step, so the test can invoke them. Named
 * `mock*` because jest.mock factories are hoisted above every other binding and
 * may only close over identifiers with that prefix.
 */
const mockRendered: {
  landing?: { onLogin: () => Promise<void>; onGetStarted: () => void };
  welcome?: { visible: boolean; recoveryLink: React.ReactNode };
} = {};
const mockRouter = { replace: jest.fn(), push: jest.fn() };
const mockHandleLogin = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ handleLogin: mockHandleLogin }),
}));
jest.mock('zustand/react/shallow', () => ({ useShallow: (selector: unknown) => selector }));
jest.mock('@/store/useOnboardingStore', () => ({
  useOnboardingStore: (selector: (state: unknown) => unknown) =>
    selector({ setHasSeenOnboarding: jest.fn() }),
}));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: (state: unknown) => unknown) =>
    selector({ loginInfo: { status: 'idle' } }),
}));
jest.mock('@/components/PasskeyFaqModal', () => ({ __esModule: true, default: () => null }));
// Both ship untranspiled JSX in their published bundles, which the project's
// `transformIgnorePatterns` does not cover. They only dress the recovery prompt.
jest.mock('@/components/ui/text', () => ({
  Text: ({ children }: { children?: React.ReactNode }) =>
    jest.requireActual<typeof React>('react').createElement('Text', null, children),
}));
jest.mock('lucide-react-native', () => ({ ChevronRight: () => null }));

// The two steps are replaced by props-recorders: this test is about which screen
// a failed login leaves the user on, not about the hero layout or the sheet
// animation — both of which pull in reanimated and the native image loader.
jest.mock('@/components/Onboarding/NewOnboarding/LandingScreen', () => ({
  LandingScreen: (props: Record<string, unknown>) => {
    Object.assign(mockRendered, { landing: props });
    return null;
  },
}));
jest.mock('@/components/Onboarding/NewOnboarding/WelcomeSheet', () => ({
  WelcomeSheet: (props: Record<string, unknown>) => {
    Object.assign(mockRendered, { welcome: props });
    return null;
  },
}));
jest.mock('@/components/Onboarding/NewOnboarding/OnboardingHeroBackground', () => ({
  OnboardingHeroBackground: () => null,
}));

/**
 * The bug this pins: a user who taps "Log in", passes Face ID, and whose passkey
 * the backend cannot tie to an account was replaced onto "Create your account" —
 * where signup then refuses their own email as already registered. Reported as
 * "Passkey Login Redirecting Existing User to Create Account".
 */
describe('onboarding, when a passkey login fails', () => {
  const renderOnboarding = async () => {
    await act(async () => {
      create(<OnboardingNew />);
    });
  };

  const pressLogin = async () => {
    await act(async () => {
      await mockRendered.landing?.onLogin();
    });
  };

  beforeEach(() => {
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    mockHandleLogin.mockReset();
    (Toast.show as jest.Mock).mockClear();
    delete mockRendered.landing;
    delete mockRendered.welcome;
  });

  it('keeps an unlinked passkey on onboarding instead of sending it to signup', async () => {
    mockHandleLogin.mockRejectedValue(
      Object.assign(new Error('This passkey is not linked to a Solid account.'), {
        name: 'ApiError',
        status: 404,
        statusCode: 404,
        code: PASSKEY_ACCOUNT_NOT_FOUND_CODE,
      }),
    );

    await renderOnboarding();
    await pressLogin();

    expect(mockRouter.replace).not.toHaveBeenCalledWith(path.SIGNUP_EMAIL);
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text1: "Passkey isn't linked to an account",
        text2: 'This passkey is not linked to a Solid account.',
      }),
    );
  });

  it('keeps the raw "User not found" of an untyped 404 off the screen', async () => {
    // What the deployed backend still answers. The toast is built from the
    // thrown error, so reading its `message` put the alarming wording in front
    // of a user whose account is fine.
    mockHandleLogin.mockRejectedValue(
      Object.assign(new Error('User not found'), {
        name: 'ApiError',
        status: 404,
        statusCode: 404,
      }),
    );

    await renderOnboarding();
    await pressLogin();

    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({
        text1: "Passkey isn't linked to an account",
        text2: PASSKEY_UNLINKED_MESSAGE,
      }),
    );
  });

  it('raises the Welcome sheet so recovery is reachable from the landing step', async () => {
    // The landing screen has no slot for the recovery prompt, so a login started
    // there used to fail with nothing on screen but the hero.
    mockHandleLogin.mockRejectedValue(
      Object.assign(new Error('User not found'), {
        name: 'ApiError',
        status: 404,
        statusCode: 404,
      }),
    );

    await renderOnboarding();
    expect(mockRendered.welcome?.visible).toBe(false);

    await pressLogin();

    expect(mockRendered.welcome?.visible).toBe(true);
    expect(mockRendered.welcome?.recoveryLink).toBeTruthy();
  });

  it('still offers recovery for failures that are not a 404', async () => {
    mockHandleLogin.mockRejectedValue(new Error('Network request failed'));

    await renderOnboarding();
    await pressLogin();

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ text1: 'Login failed', text2: 'Network request failed' }),
    );
    expect(mockRendered.welcome?.recoveryLink).toBeTruthy();
  });

  it('leaves the onboarding screen alone when the login succeeds', async () => {
    // handleLogin navigates to Home itself; onboarding must not second-guess it.
    mockHandleLogin.mockResolvedValue(undefined);

    await renderOnboarding();
    await pressLogin();

    expect(Toast.show).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRendered.welcome?.visible).toBe(false);
  });

  it('keeps "Get started" as the deliberate way to the Welcome sheet', async () => {
    mockHandleLogin.mockResolvedValue(undefined);

    await renderOnboarding();
    await act(async () => {
      mockRendered.landing?.onGetStarted();
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRendered.welcome?.visible).toBe(true);
  });
});
