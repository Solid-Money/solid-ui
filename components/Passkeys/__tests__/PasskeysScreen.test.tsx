import React from 'react';

import Passkeys from '@/app/(protected)/(tabs)/settings/passkeys';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * What the Passkeys screen (Settings → Security → Passkeys) shows for one
 * passkey versus several, and that its controls reach the manager. The manager
 * itself (Turnkey and the API) is replaced: its behaviour belongs to its own
 * tests, and this one is about what the user sees and can press.
 *
 * Mocks are named `mock*` because jest.mock factories are hoisted above every
 * other binding and may only close over identifiers with that prefix.
 */
const mockManager = {
  passkeys: [] as {
    authenticatorId: string;
    credentialId: string;
    name: string;
    createdAt: string | null;
    lastSignInAt: string | null;
  }[],
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  thisDeviceCredentialId: 'phone-credential' as string | undefined,
  addPasskey: jest.fn(),
  removePasskey: jest.fn(),
  renamePasskey: jest.fn(),
};
const mockSheet: { props?: Record<string, unknown> } = {};

jest.mock('@/hooks/usePasskeyManager', () => ({ usePasskeyManager: () => mockManager }));
jest.mock('@/hooks/usePasskey', () => ({ usePasskey: () => ({ isPasskeySupported: true }) }));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isDesktop: false }) }));
jest.mock('@/lib/api', () => ({}));
jest.mock('@/lib/utils/passkeyDevice', () => ({ getThisDeviceNoun: () => 'this iPhone' }));
// The barrel reaches AsyncStorage and the API client at load; the screen needs two helpers.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(value => typeof value === 'string').join(' '),
  describePasskeyActivity: jest.requireActual('@/lib/utils/passkey').describePasskeyActivity,
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
  ChevronRight: () => null,
  KeyRound: () => null,
  Plus: () => null,
}));
jest.mock('@/components/Passkeys/PasskeyOptionsSheet', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSheet.props = props;
    return null;
  },
}));

const today = new Date();
const PHONE = {
  authenticatorId: 'auth-phone',
  credentialId: 'phone-credential',
  name: 'iPhone 15 Pro',
  createdAt: '2025-03-12T00:00:00.000Z',
  lastSignInAt: today.toISOString(),
};
const KEY = {
  authenticatorId: 'auth-key',
  credentialId: 'key-credential',
  name: 'YubiKey',
  createdAt: '2025-06-01T00:00:00.000Z',
  lastSignInAt: null,
};

const render = () => {
  let renderer: any;
  act(() => {
    renderer = create(<Passkeys />);
  });
  return renderer;
};

/** Every string the screen renders, in order. */
const textsOf = (renderer: any): string[] =>
  renderer.root
    .findAll((node: any) => node.type === 'Text')
    .map((node: any) => [node.props.children].flat(Infinity).join(''));

const addButtons = (renderer: any) =>
  renderer.root.findAll(
    (node: any) => node.type === 'Button' && node.props.accessibilityLabel === 'Add a passkey',
  );

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockManager, { isLoading: false, isError: false, passkeys: [PHONE] });
  delete mockSheet.props;
});

describe('Passkeys screen', () => {
  it('leads with the case for a backup when there is only one passkey', () => {
    const texts = textsOf(render());

    expect(texts).toContain('Add a backup passkey');
    expect(texts.join(' ')).toContain('if you lose this iPhone');
    expect(texts.join(' ')).toContain("You can't remove your only passkey.");
    expect(texts).toContain('This device · Signed in today');
  });

  it('drops the backup prompt once there is a second passkey', () => {
    mockManager.passkeys = [PHONE, KEY];
    const renderer = render();
    const texts = textsOf(renderer);

    expect(texts).not.toContain('Add a backup passkey');
    expect(texts.join(' ')).not.toContain("You can't remove your only passkey.");
    expect(texts).toContain('Added 1 Jun 2025');
    // Adding is still offered, below the list.
    expect(addButtons(renderer)).toHaveLength(1);
  });

  it('shows why an add did not go through', async () => {
    mockManager.addPasskey.mockResolvedValue({
      status: 'failed',
      message: "The new passkey wasn't added to your account.",
    });
    const renderer = render();

    await act(async () => {
      await addButtons(renderer)[0].props.onPress();
    });

    expect(mockManager.addPasskey).toHaveBeenCalledTimes(1);
    expect(textsOf(renderer)).toContain("The new passkey wasn't added to your account.");
  });

  it('says nothing when the user closes the system prompt', async () => {
    mockManager.addPasskey.mockResolvedValue({ status: 'cancelled' });
    const renderer = render();
    const before = textsOf(renderer);

    await act(async () => {
      await addButtons(renderer)[0].props.onPress();
    });

    expect(textsOf(renderer)).toEqual(before);
  });

  it("opens a passkey's options from its row", () => {
    mockManager.passkeys = [PHONE, KEY];
    const renderer = render();
    const row = renderer.root.find(
      (node: any) =>
        typeof node.props.accessibilityLabel === 'string' &&
        node.props.accessibilityLabel.startsWith('YubiKey') &&
        typeof node.props.onPress === 'function',
    );

    act(() => row.props.onPress());

    expect(mockSheet.props).toMatchObject({
      isOpen: true,
      passkey: KEY,
      isThisDevice: false,
      isOnlyPasskey: false,
    });
  });

  it('offers a retry when the list cannot be read', () => {
    Object.assign(mockManager, { isError: true, passkeys: [] });

    const texts = textsOf(render());

    expect(texts).toContain("We couldn't load your passkeys.");
    expect(texts).not.toContain('Add a backup passkey');
  });
});
