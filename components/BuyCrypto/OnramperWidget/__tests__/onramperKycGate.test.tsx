import React from 'react';

import { OnramperKycGate } from '@/components/BuyCrypto/OnramperWidget/OnramperKycGate';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('lucide-react-native', () => ({ Check: 'Check', ShieldCheck: 'ShieldCheck' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/components/BuyCrypto/OnramperWidget/OnramperWidgetStates', () => ({
  ONRAMPER_WIDGET_HEIGHT: 630,
  OnramperWidgetLoading: 'OnramperWidgetLoading',
}));
jest.mock('@/hooks/useOnramperWidget', () => ({
  useOnramperKycShare: () => mockAvailability,
}));

let mockAvailability: { data?: { available: boolean }; isPending: boolean };

/** Renders the gate with a stand-in widget that shows what it was handed. */
const render = () => {
  let root: any;
  act(() => {
    root = create(
      <OnramperKycGate>{shareKyc => React.createElement('Widget', { shareKyc })}</OnramperKycGate>,
    );
  });
  return root;
};

const widgetOf = (root: any) => root.root.findAllByType('Widget')[0];
const buttonsOf = (root: any) => root.root.findAllByType('Button');

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

it('waits for the answer before minting anything', () => {
  mockAvailability = { isPending: true };
  const root = render();

  expect(root.root.findAllByType('OnramperWidgetLoading')).toHaveLength(1);
  expect(widgetOf(root)).toBeUndefined();
  act(() => root.unmount());
});

it('opens the widget without asking a user who has nothing to share', () => {
  mockAvailability = { data: { available: false }, isPending: false };
  const root = render();

  expect(widgetOf(root).props.shareKyc).toBe(false);
  expect(track).not.toHaveBeenCalled();
  act(() => root.unmount());
});

it('opens the widget without sharing when the check failed', () => {
  mockAvailability = { data: undefined, isPending: false };
  const root = render();

  expect(widgetOf(root).props.shareKyc).toBe(false);
  act(() => root.unmount());
});

it('asks a verified user first, and shares once they agree', () => {
  mockAvailability = { data: { available: true }, isPending: false };
  const root = render();

  expect(widgetOf(root)).toBeUndefined();
  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_VIEWED);

  const [share] = buttonsOf(root);
  act(() => share.props.onPress());

  expect(widgetOf(root).props.shareKyc).toBe(true);
  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_ACCEPTED);
  act(() => root.unmount());
});

it('still opens the widget, unshared, for a user who declines', () => {
  mockAvailability = { data: { available: true }, isPending: false };
  const root = render();

  const [, decline] = buttonsOf(root);
  act(() => decline.props.onPress());

  expect(widgetOf(root).props.shareKyc).toBe(false);
  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_DECLINED);
  act(() => root.unmount());
});
