import React from 'react';

import { TransfiError } from '@/components/BuyCrypto/Transfi/TransfiError';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRANSFI_ERROR_CODE, TransfiError as TransfiFailure } from '@/lib/transfiErrors';
import { useTransfiStore } from '@/store/useTransfiStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockSetModal = jest.fn();
const mockRouteToKyc = jest.fn();
const mockUpgrade = jest.fn();
const mockOpenBrowser = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowser(...args),
}));
jest.mock('lucide-react-native', () => ({
  AlertTriangle: 'Icon',
  Clock: 'Icon',
  LifeBuoy: 'Icon',
  ShieldAlert: 'Icon',
  XCircle: 'Icon',
}));
jest.mock('@/components/BuyCrypto/Transfi/BuyCryptoNavigation', () => ({
  useBuyCryptoNavigation: () => mockSetModal,
}));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/hooks/useBuyCryptoKycRoute', () => ({
  useBuyCryptoKycRoute: () => mockRouteToKyc,
}));
jest.mock('@/hooks/useTransfi', () => ({
  useUpgradeTransfiKyc: () => ({ mutateAsync: mockUpgrade, isPending: false }),
}));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));

/** Every string the screen renders, in order. */
const textsIn = (node: any): string[] =>
  node.findAllByType('Text').map((text: any) => [text.props.children].flat().join(''));

const buttonLabelled = (node: any, label: string) =>
  node.findAllByType('Button').find((button: any) => textsIn(button).includes(label));

const limitRefusal = (code: string = TRANSFI_ERROR_CODE.STANDARD_KYC_REQUIRED) =>
  new TransfiFailure(
    code,
    'complete_kyc',
    'Please upgrade your KYC to make further purchases.',
    400,
  );

const render = () => {
  let root: any;
  act(() => {
    root = create(<TransfiError />);
  });
  return root;
};

const press = async (root: any, label: string) => {
  await act(async () => {
    buttonLabelled(root.root, label).props.onPress();
  });
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  useTransfiStore.getState().reset();
});

it('asks for a KYC upgrade, with a smaller purchase as the way round it', () => {
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  expect(textsIn(root.root)).toEqual(
    expect.arrayContaining([
      'Upgrade your verification',
      'Please upgrade your KYC to make further purchases.',
      'Verify identity',
      'Buy a smaller amount',
      'Go to home',
    ]),
  );
  act(() => root.unmount());
});

// Our identity flow finds this user already verified and sends them straight
// back to the amount screen — the loop this replaces.
it('opens TransFi’s verification page instead of our identity flow', async () => {
  mockUpgrade.mockResolvedValue({
    level: 'standard',
    status: 'started',
    kycUrl: 'https://kyc.transfi/1',
  });
  mockOpenBrowser.mockResolvedValue({ type: 'dismiss' });
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  await press(root, 'Verify identity');

  expect(mockUpgrade).toHaveBeenCalledWith('standard');
  expect(mockOpenBrowser).toHaveBeenCalledWith('https://kyc.transfi/1');
  expect(mockRouteToKyc).not.toHaveBeenCalled();
  expect(textsIn(root.root)).toContain('Reopen verification page');
  act(() => root.unmount());
});

it('asks for the advanced level when the order needs enhanced KYC', async () => {
  mockUpgrade.mockResolvedValue({
    level: 'advanced',
    status: 'started',
    kycUrl: 'https://kyc.transfi/2',
  });
  mockOpenBrowser.mockResolvedValue({ type: 'dismiss' });
  useTransfiStore.getState().setError(limitRefusal(TRANSFI_ERROR_CODE.ENHANCED_KYC_REQUIRED));
  const root = render();

  await press(root, 'Verify identity');

  expect(mockUpgrade).toHaveBeenCalledWith('advanced');
  act(() => root.unmount());
});

it('shows the review in progress, not the button, when TransFi already has a submission', async () => {
  mockUpgrade.mockResolvedValue({ level: 'standard', status: 'pending' });
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  await press(root, 'Verify identity');

  const shown = textsIn(root.root);
  expect(shown).toContain('Verification in review');
  expect(shown).not.toContain('Verify identity');
  expect(shown).toContain('Buy a smaller amount');
  expect(mockOpenBrowser).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('keeps the button when the upgrade fails transiently', async () => {
  mockUpgrade.mockRejectedValue(
    new TransfiFailure('TRANSFI_KYC_UPGRADE_UNAVAILABLE', 'retry', 'unavailable', 502),
  );
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  await press(root, 'Verify identity');

  const shown = textsIn(root.root);
  expect(shown).toContain('We couldn’t open the verification page. Please try again in a moment.');
  expect(shown).toContain('Verify identity');
  act(() => root.unmount());
});

it('shows a refusal with its own verdict in place of the upgrade', async () => {
  const barred = new TransfiFailure(
    'USER_BLOCKED_OR_REJECTED',
    'contact_support',
    'Your account can’t buy crypto right now.',
    412,
  );
  mockUpgrade.mockRejectedValue(barred);
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  await press(root, 'Verify identity');

  expect(useTransfiStore.getState().error).toBe(barred);
  act(() => root.unmount());
});

it('goes back to the amount screen for a smaller purchase', async () => {
  useTransfiStore.getState().setError(limitRefusal());
  const root = render();

  await press(root, 'Buy a smaller amount');

  expect(mockSetModal).toHaveBeenCalledWith(DEPOSIT_MODAL.OPEN_BUY_CRYPTO_AMOUNT);
  act(() => root.unmount());
});

it('still sends a user with no verification to our identity flow', async () => {
  useTransfiStore
    .getState()
    .setError(
      new TransfiFailure(
        TRANSFI_ERROR_CODE.KYC_REQUIRED,
        'complete_kyc',
        'Finish verifying your identity to buy crypto.',
        412,
      ),
    );
  const root = render();

  await press(root, 'Verify identity');

  expect(mockRouteToKyc).toHaveBeenCalled();
  expect(mockUpgrade).not.toHaveBeenCalled();
  expect(textsIn(root.root)).not.toContain('Buy a smaller amount');
  act(() => root.unmount());
});
