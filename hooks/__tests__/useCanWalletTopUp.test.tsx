import React from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useWalletTopUpEntry } from '@/hooks/useCanWalletTopUp';
import { track } from '@/lib/analytics';
import { useWalletTopUpStore } from '@/store/useWalletTopUpStore';

import type { WalletDeviceAvailability } from '@/lib/walletTopUp';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

/**
 * The top-up row both entry points show: hidden unless the backend and the
 * device both said yes, and a tap that starts the same flow from either.
 */

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn() } }));
jest.mock('@/hooks/useWalletTopUpAvailability', () => ({
  useWalletTopUpAvailability: () => ({
    availability: mockBackend.isAvailable ? {} : undefined,
    isAvailable: mockBackend.isAvailable,
    isLoading: false,
  }),
}));
jest.mock('@/hooks/useWalletDeviceAvailability', () => ({
  useWalletDeviceAvailability: () => ({ device: mockDevice.current, recheck: mockRecheck }),
}));

const mockBackend = { isAvailable: true };
const mockDevice: { current: WalletDeviceAvailability | null } = { current: null };
const mockRecheck = jest.fn(async () => {});
const mockTrack = track as jest.MockedFunction<typeof track>;
const originalPlatform = Platform.OS;

const device = (overrides: Partial<WalletDeviceAvailability>): WalletDeviceAvailability => ({
  applePay: false,
  googlePay: false,
  googlePayHandoff: false,
  googlePayNeedsCard: false,
  ...overrides,
});

type Entry = ReturnType<typeof useWalletTopUpEntry>;

const renderEntry = (open: () => void, isShown = true) => {
  // Collected rather than assigned: the react-compiler rule treats reassigning
  // an outer binding from a component as a render side-effect.
  const seen: Entry[] = [];
  const Probe = () => {
    seen.push(useWalletTopUpEntry('card_fund', open, isShown));
    return null;
  };
  let root: any;
  act(() => {
    root = create(<Probe />);
  });
  return { entry: () => seen[seen.length - 1], unmount: () => act(() => root.unmount()) };
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockBackend.isAvailable = true;
  mockDevice.current = null;
  useWalletTopUpStore.getState().reset();
  Platform.OS = 'ios';
});

afterEach(() => {
  Platform.OS = originalPlatform;
});

it('stays hidden until the device has answered', () => {
  const { entry, unmount } = renderEntry(jest.fn());
  expect(entry().visible).toBe(false);
  expect(mockTrack).not.toHaveBeenCalled();
  unmount();
});

it('stays hidden when the backend does not offer it, whatever the device can do', () => {
  mockBackend.isAvailable = false;
  mockDevice.current = device({ applePay: true });
  const { entry, unmount } = renderEntry(jest.fn());
  expect(entry().visible).toBe(false);
  unmount();
});

it('offers Apple Pay on an iPhone that can pay, and reports the row as seen', () => {
  mockDevice.current = device({ applePay: true });
  const { entry, unmount } = renderEntry(jest.fn());
  expect(entry()).toMatchObject({ visible: true, method: 'apple_pay', needsCard: false });
  expect(mockTrack).toHaveBeenCalledWith(TRACKING_EVENTS.WALLET_TOPUP_ROW_VIEWED, {
    source: 'card_fund',
    payment_method: 'apple_pay',
    needs_card: false,
  });
  unmount();
});

it('does not report a row its host is not showing yet', () => {
  mockDevice.current = device({ applePay: true });
  const { unmount } = renderEntry(jest.fn(), false);
  expect(mockTrack).not.toHaveBeenCalled();
  unmount();
});

it('starts the flow on a tap: the deposit method, the wallet, then the first step', () => {
  Platform.OS = 'android';
  mockDevice.current = device({ googlePay: true });
  const open = jest.fn();
  const { entry, unmount } = renderEntry(open);
  act(() => entry().onPress());

  expect(mockTrack).toHaveBeenCalledWith(TRACKING_EVENTS.DEPOSIT_METHOD_SELECTED, {
    deposit_method: 'wallet_topup',
    provider: 'wirex',
    payment_method: 'google_pay',
    source: 'card_fund',
  });
  expect(useWalletTopUpStore.getState()).toMatchObject({
    method: 'google_pay',
    source: 'card_fund',
  });
  expect(open).toHaveBeenCalledTimes(1);
  unmount();
});

it('asks for a card in Google Wallet first, instead of opening a checkout it cannot pay', () => {
  Platform.OS = 'web';
  mockDevice.current = device({ googlePayNeedsCard: true });
  const open = jest.fn();
  const { entry, unmount } = renderEntry(open);
  expect(entry()).toMatchObject({ visible: true, method: 'google_pay', needsCard: true });

  act(() => entry().onPress());
  expect(open).not.toHaveBeenCalled();
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'info', text1: 'Add a card to Google Wallet first' }),
  );
  expect(mockRecheck).toHaveBeenCalled();
  unmount();
});
