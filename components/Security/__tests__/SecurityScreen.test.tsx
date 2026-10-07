import React from 'react';

import Security from '@/app/(protected)/(tabs)/settings/security';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * What Security shows for the protections an account has, and that setting up
 * 2FA asks for a passkey first — the screen no longer has an unlock step, so
 * that prompt is the only thing between an unlocked phone and a new
 * authenticator on the account.
 *
 * Mocks are named `mock*` because jest.mock factories are hoisted above every
 * other binding and may only close over identifiers with that prefix.
 */
const mockUser: { email?: string; hasPasskey?: boolean } = {};
const mockTotpStatus = jest.fn();
const mockStamp = jest.fn();
const mockPush = jest.fn();
const mockModals: Record<string, Record<string, unknown> | undefined> = {};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@turnkey/react-native-wallet-kit', () => ({
  StamperType: { Passkey: 'passkey' },
  useTurnkey: () => ({ createHttpClient: () => ({ stampGetWhoami: mockStamp }) }),
}));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: () => ({ user: mockUser }) }));
jest.mock('@/hooks/usePasskeyManager', () => ({
  usePasskeyManager: () => ({
    passkeys: [{ credentialId: 'phone-credential' }],
    isLoading: false,
    isError: false,
    thisDeviceCredentialId: 'phone-credential',
  }),
}));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isDesktop: false }) }));
jest.mock('@/lib/api', () => ({ getTotpStatus: () => mockTotpStatus() }));
jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_TURNKEY_ORGANIZATION_ID: 'parent-org' }));
jest.mock('@/lib/utils/passkeyDevice', () => ({ getThisDeviceNoun: () => 'this iPhone' }));
// The barrel reaches AsyncStorage and the API client at load; the screen needs two helpers.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(value => typeof value === 'string').join(' '),
  isPasskeyPromptError: jest.requireActual('@/lib/utils/passkey').isPasskeyPromptError,
}));
// Each lazy modal becomes a recorder of the props it was opened with.
jest.mock('@/lib/lazyWithRetry', () => ({
  lazyWithRetry: (load: () => unknown) => {
    const name = String(load).includes('SecurityTotpModal') ? 'totp' : 'email';
    return (props: Record<string, unknown>) => {
      mockModals[name] = props;
      return null;
    };
  },
}));
jest.mock('@/components/PageLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/Navbar', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/back-button', () => ({ BackButton: () => null }));
jest.mock('@/components/ui/text', () => ({
  Text: ({ children }: { children?: React.ReactNode }) =>
    jest.requireActual<typeof React>('react').createElement('Text', null, children),
}));
jest.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) =>
    jest
      .requireActual<typeof React>('react')
      .createElement('Button', props, props.children as React.ReactNode),
}));
jest.mock('lucide-react-native', () => ({
  AlertCircle: () => null,
  Check: () => null,
  ChevronRight: () => null,
  KeyRound: () => null,
  Lock: () => null,
  Mail: () => null,
  ShieldCheck: () => null,
}));

const render = async () => {
  let renderer: any;
  await act(async () => {
    renderer = create(<Security />);
  });
  return renderer;
};

const textsOf = (renderer: any): string[] =>
  renderer.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat(Infinity).join(''));

const byLabel = (renderer: any, label: string) =>
  renderer.root.find(
    (node: any) =>
      node.props.accessibilityLabel === label && typeof node.props.onPress === 'function',
  );

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockModals).forEach(key => delete mockModals[key]);
  Object.assign(mockUser, { email: 'eli@fuse.io', hasPasskey: true });
  mockTotpStatus.mockResolvedValue({ verified: false });
  mockStamp.mockResolvedValue({ stamp: {} });
});

describe('Security screen', () => {
  it('counts two of three protections and offers 2FA next', async () => {
    const texts = textsOf(await render());

    expect(texts).toContain('2 of 3 protections on');
    expect(texts).toContain('Set up 2FA');
    expect(texts).toContain('1 passkey · this iPhone');
    expect(texts).toContain('Off');
    expect(texts).toContain('Verified');
  });

  it('asks for a passkey before opening 2FA setup', async () => {
    const renderer = await render();

    await act(async () => {
      await byLabel(renderer, 'Set up 2FA').props.onPress();
    });

    expect(mockStamp).toHaveBeenCalledWith({ organizationId: 'parent-org' }, 'passkey');
    expect(mockModals.totp).toMatchObject({ open: true });
  });

  it('keeps 2FA setup closed when the passkey prompt is dismissed', async () => {
    mockStamp.mockRejectedValue(
      Object.assign(new Error('The user cancelled the request.'), { name: 'NotAllowedError' }),
    );
    const renderer = await render();
    const before = textsOf(renderer);

    await act(async () => {
      await byLabel(renderer, 'Set up two-factor authentication').props.onPress();
    });

    expect(mockModals.totp).toBeUndefined();
    // A cancelled prompt is the user's choice, not an error to report.
    expect(textsOf(renderer)).toEqual(before);
  });

  it('asks for a recovery email first when there is none', async () => {
    mockUser.email = undefined;
    const renderer = await render();

    expect(textsOf(renderer)).toContain('Add recovery email');

    await act(async () => {
      await byLabel(renderer, 'Add recovery email').props.onPress();
    });

    expect(mockModals.email).toMatchObject({ open: true });
    expect(mockStamp).not.toHaveBeenCalled();
  });

  it('shows everything on, with nothing to set up', async () => {
    mockTotpStatus.mockResolvedValue({ verified: true });
    const renderer = await render();
    const texts = textsOf(renderer);

    expect(texts).toContain('3 of 3 protections on');
    expect(texts).not.toContain('Set up 2FA');
    expect(texts).toContain('On');
    expect(() => byLabel(renderer, 'Set up two-factor authentication')).toThrow();
  });

  it('opens Passkeys from its row', async () => {
    const renderer = await render();

    act(() => byLabel(renderer, 'Passkeys').props.onPress());

    expect(mockPush).toHaveBeenCalledWith('/settings/passkeys');
  });
});
