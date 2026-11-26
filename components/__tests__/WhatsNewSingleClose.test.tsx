import React from 'react';

import WhatsNewSingleDrawerNative from '@/components/WhatsNew/WhatsNewSingleDrawer.native';
import WhatsNewSinglePopup from '@/components/WhatsNew/WhatsNewSinglePopup';

import type { SingleWhatsNew } from '@/lib/whatsNew';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

// The web drawer by its own file name: Jest, like iOS and Android, resolves the
// bare name to `WhatsNewSingleDrawer.native.tsx`.
const WhatsNewSingleDrawerWeb: typeof import('@/components/WhatsNew/WhatsNewSingleDrawer').default =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/components/WhatsNew/WhatsNewSingleDrawer.tsx').default;

const mockPlatform = { OS: 'ios' };
const mockBackHandlers: (() => boolean)[] = [];
const mockSheet = { present: jest.fn(), dismiss: jest.fn() };

jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'));
jest.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Pressable: 'Pressable',
  // Read when used: the factory runs before `mockPlatform` is assigned.
  get Platform() {
    return mockPlatform;
  },
  Linking: { openURL: jest.fn(() => Promise.resolve()) },
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  BackHandler: {
    addEventListener: (_event: string, handler: () => boolean) => {
      mockBackHandlers.push(handler);
      return {
        remove: () => mockBackHandlers.splice(mockBackHandlers.indexOf(handler), 1),
      };
    },
  },
}));
jest.mock('react-native-reanimated', () => {
  const chain: Record<string, unknown> = {};
  for (const key of ['duration', 'springify', 'stiffness', 'damping', 'mass']) {
    chain[key] = () => chain;
  }
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    FadeIn: chain,
    FadeInDown: chain,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    withSpring: (value: number) => value,
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock('react-native-gesture-handler', () => {
  const pan: Record<string, unknown> = {};
  for (const key of [
    'activeOffsetY',
    'failOffsetX',
    'onStart',
    'onUpdate',
    'onEnd',
    'onFinalize',
  ]) {
    pan[key] = () => pan;
  }
  return { Gesture: { Pan: () => pan }, GestureDetector: 'GestureDetector' };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  return {
    // `dismiss` slides the sheet away, then reports it, as Gorhom does.
    BottomSheetModal: React.forwardRef(function MockSheet(props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
        present: mockSheet.present,
        dismiss: () => {
          mockSheet.dismiss();
          props.onDismiss?.();
        },
      }));
      return React.createElement('BottomSheetModal', props);
    }),
    BottomSheetBackdrop: 'BottomSheetBackdrop',
    BottomSheetView: 'BottomSheetView',
  };
});
jest.mock('@/components/ui/dialog', () => ({ Dialog: 'Dialog', DialogContent: 'DialogContent' }));
jest.mock('@/components/WhatsNew/WhatsNewMedia', () => ({
  __esModule: true,
  default: 'WhatsNewMedia',
  VideoLayer: 'VideoLayer',
}));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isScreenMedium: false }) }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const SINGLE: SingleWhatsNew = {
  _id: 'single-1',
  isActive: true,
  showOnLoad: false,
  format: 'single',
  presentation: 'drawer',
  media: { type: 'image', url: 'https://cdn.test/bf.png', width: 1080, height: 1350, alt: 'Sale' },
  link: '/rewards/benefits',
  steps: [],
  createdAt: '2026-11-25T00:00:00.000Z',
};

const mediaProps = { hasLink: true, onSoundOn: jest.fn(), watchedSecondsRef: { current: null } };

type Component = typeof WhatsNewSinglePopup;

const render = (Single: Component) => {
  const onRequestClose = jest.fn();
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <Single whatsNew={SINGLE} isActive mediaProps={mediaProps} onRequestClose={onRequestClose} />,
    );
  });
  return {
    renderer: renderer!,
    onRequestClose,
    media: () => renderer!.root.findByType('WhatsNewMedia').props,
  };
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPlatform.OS = 'ios';
  mockBackHandlers.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('WhatsNewSinglePopup', () => {
  const backdrop = (renderer: ReturnType<typeof create>) =>
    renderer.root.find((node: any) => node.type === 'Pressable');

  it.each([
    ['ios', 'back'],
    ['android', 'back'],
    ['web', 'esc'],
  ])('closes on %s back / Esc as %s', (os, reason) => {
    mockPlatform.OS = os;
    const popup = render(WhatsNewSinglePopup);

    act(() => popup.renderer.root.findByType('Modal').props.onRequestClose());

    expect(popup.onRequestClose).toHaveBeenCalledWith(reason);
    act(() => popup.renderer.unmount());
  });

  it('closes on its X, a tap outside, and opens the link on a tap', () => {
    const popup = render(WhatsNewSinglePopup);

    act(() => popup.media().onClose());
    act(() => backdrop(popup.renderer).props.onPress());
    act(() => popup.media().onPress());

    expect(popup.onRequestClose.mock.calls).toEqual([['close_button'], ['backdrop'], ['click']]);
    act(() => popup.renderer.unmount());
  });
});

describe('WhatsNewSingleDrawer (iOS and Android)', () => {
  it('presents itself, and closes on its X once it has slid away', () => {
    const drawer = render(WhatsNewSingleDrawerNative);
    expect(mockSheet.present).toHaveBeenCalled();

    act(() => drawer.media().onClose());

    expect(mockSheet.dismiss).toHaveBeenCalledTimes(1);
    expect(drawer.onRequestClose.mock.calls).toEqual([['close_button']]);
    // The video stops the moment the close starts.
    expect(drawer.media().isActive).toBe(false);
    act(() => drawer.renderer.unmount());
  });

  it('closes on Android back, and keeps Back from leaving the screen under it', () => {
    const drawer = render(WhatsNewSingleDrawerNative);
    expect(mockBackHandlers).toHaveLength(1);

    let handled = false;
    act(() => {
      handled = mockBackHandlers[mockBackHandlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(drawer.onRequestClose.mock.calls).toEqual([['back']]);

    // A second press while it slides away is still the drawer's, and closes nothing twice.
    act(() => {
      handled = mockBackHandlers[mockBackHandlers.length - 1]();
    });
    expect(handled).toBe(true);
    expect(drawer.onRequestClose).toHaveBeenCalledTimes(1);

    act(() => drawer.renderer.unmount());
    expect(mockBackHandlers).toHaveLength(0);
  });

  it('reports a tap outside as the backdrop and a pull down as a swipe', () => {
    const backdropDrawer = render(WhatsNewSingleDrawerNative);
    const sheet = backdropDrawer.renderer.root.findByType('BottomSheetModal').props;
    const backdrop = sheet.backdropComponent({}).props;
    expect(backdrop.pressBehavior).toBe('close');
    act(() => {
      backdrop.onPress();
      // Gorhom closes the sheet after the backdrop's own onPress.
      sheet.onDismiss();
    });
    expect(backdropDrawer.onRequestClose.mock.calls).toEqual([['backdrop']]);
    act(() => backdropDrawer.renderer.unmount());

    const swiped = render(WhatsNewSingleDrawerNative);
    act(() => swiped.renderer.root.findByType('BottomSheetModal').props.onDismiss());
    expect(swiped.onRequestClose.mock.calls).toEqual([['swipe']]);
    act(() => swiped.renderer.unmount());
  });
});

describe('WhatsNewSingleDrawer (web)', () => {
  beforeEach(() => {
    mockPlatform.OS = 'web';
  });

  const dialog = (renderer: ReturnType<typeof create>) => renderer.root.findByType('Dialog').props;

  it('closes on its X once the sheet has slid away, and only once', () => {
    const drawer = render(WhatsNewSingleDrawerWeb);

    act(() => drawer.media().onClose());
    act(() => drawer.media().onClose());
    expect(dialog(drawer.renderer).open).toBe(false);
    expect(drawer.onRequestClose).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(200));
    expect(drawer.onRequestClose.mock.calls).toEqual([['close_button']]);
    act(() => drawer.renderer.unmount());
  });

  it('closes on Esc', () => {
    const drawer = render(WhatsNewSingleDrawerWeb);

    act(() => {
      drawer.renderer.root.findByType('DialogContent').props.onEscapeKeyDown();
      dialog(drawer.renderer).onOpenChange(false);
    });
    act(() => jest.advanceTimersByTime(200));

    expect(drawer.onRequestClose.mock.calls).toEqual([['esc']]);
    act(() => drawer.renderer.unmount());
  });

  it('closes on a tap outside', () => {
    const drawer = render(WhatsNewSingleDrawerWeb);

    act(() => dialog(drawer.renderer).onOpenChange(false));
    act(() => jest.advanceTimersByTime(200));

    expect(drawer.onRequestClose.mock.calls).toEqual([['backdrop']]);
    act(() => drawer.renderer.unmount());
  });
});
