import React from 'react';

import WhatsNewModal from '@/components/WhatsNewModal';
import { carouselLayout } from '@/lib/whatsNew';

import type { WhatsNew } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockScrollTo = jest.fn();
const mockWindow = { width: 419, height: 900 };
const mockPlatform = { OS: 'ios' };

jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'));
jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    Modal: 'Modal',
    View: 'View',
    Pressable: 'Pressable',
    // Read when used: the factory runs before `mockPlatform` is assigned.
    get Platform() {
      return mockPlatform;
    },
    Linking: { openURL: jest.fn(() => Promise.resolve()) },
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    useWindowDimensions: () => mockWindow,
    ScrollView: React.forwardRef(function MockScrollView(props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return React.createElement('ScrollView', props);
    }),
  };
});
jest.mock('react-native-reanimated', () => {
  const chain: Record<string, unknown> = {};
  for (const key of ['duration', 'springify', 'stiffness', 'damping', 'mass']) {
    chain[key] = () => chain;
  }
  return { __esModule: true, default: { View: 'AnimatedView' }, FadeIn: chain, FadeInDown: chain };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
}));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isScreenMedium: false }) }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('@/components/WhatsNew/WhatsNewMedia', () => ({ VideoLayer: 'VideoLayer' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
// The real `cn` lives beside the wallet setup, which Jest can't load.
jest.mock('@/lib/utils', () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

const step = (title: string) => ({ title, text: '', imageUrl: `https://cdn.test/${title}.png` });
const CAROUSEL: WhatsNew = {
  _id: 'carousel-1',
  isActive: true,
  showOnLoad: false,
  steps: [step('Card'), step('Euro yield'), step('Credit')],
  createdAt: '2026-11-01T00:00:00.000Z',
};

const pageWidth = () => carouselLayout(mockWindow, false).pageWidth;

const render = (initialStep: number) => {
  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <WhatsNewModal whatsNew={CAROUSEL} isOpen onClose={jest.fn()} initialStep={initialStep} />,
    );
  });
  const pager = () => renderer!.root.find((node: any) => node.props.horizontal === true);
  const at = (x: number) => ({ nativeEvent: { contentOffset: { x, y: 0 } } });
  return {
    renderer: renderer!,
    /** The slides have been laid out (at the current window width). */
    layOut: () => act(() => pager().props.onContentSizeChange()),
    /** A scroll event the user didn't drive, e.g. a late one from before a rotation. */
    scrollTo: (x: number) => act(() => pager().props.onScroll(at(x))),
    /** The user drags to `releasedAt`, and the momentum snaps the pager to `restsAt`. */
    swipe: (releasedAt: number, restsAt: number) =>
      act(() => {
        const props = pager().props;
        props.onScrollBeginDrag();
        props.onScroll(at(releasedAt));
        props.onScrollEndDrag(at(releasedAt));
        props.onMomentumScrollBegin();
        props.onScroll(at(restsAt));
        props.onMomentumScrollEnd(at(restsAt));
      }),
    /** "Next" on every slide but the last, which says "Done". */
    primaryLabel: (): string => renderer!.root.findByType('Button').props.accessibilityLabel,
  };
};

describe('WhatsNewModal pager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockScrollTo.mockClear();
    mockWindow.width = 419;
    mockWindow.height = 900;
    mockPlatform.OS = 'ios';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens on the slide a link named, ignoring the pager until it is placed there', () => {
    const modal = render(2);
    expect(modal.primaryLabel()).toBe('Done');

    // A scroll event from before placement (the pager reporting 0 as it mounts).
    modal.scrollTo(0);
    expect(modal.primaryLabel()).toBe('Done');

    modal.layOut();
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 2 * pageWidth(), animated: false });
    expect(modal.primaryLabel()).toBe('Done');
    act(() => modal.renderer.unmount());
  });

  it("ignores an old offset whenever it lands, and follows the user's swipe", () => {
    const modal = render(2);
    modal.layOut();

    modal.scrollTo(0);
    expect(modal.primaryLabel()).toBe('Done');
    act(() => jest.advanceTimersByTime(5000));
    modal.scrollTo(0);
    expect(modal.primaryLabel()).toBe('Done');

    modal.swipe(1.4 * pageWidth(), pageWidth());
    expect(modal.primaryLabel()).toBe('Next');
    act(() => modal.renderer.unmount());
  });

  it('follows a swipe that ends right after the pager is placed', () => {
    const modal = render(2);
    modal.layOut();

    modal.swipe(0.4 * pageWidth(), 0);
    expect(modal.primaryLabel()).toBe('Next');
    act(() => modal.renderer.unmount());
  });

  it('follows every scroll on web, where the offset is read live', () => {
    mockPlatform.OS = 'web';
    const modal = render(0);
    modal.scrollTo(2 * pageWidth());
    // Not placed yet: the pager reports where it was before the first layout.
    expect(modal.primaryLabel()).toBe('Next');

    modal.layOut();
    modal.scrollTo(2 * pageWidth());
    expect(modal.primaryLabel()).toBe('Done');
    act(() => modal.renderer.unmount());
  });

  it('keeps the slide the user was on through a resize', () => {
    const modal = render(1);
    modal.layOut();
    const oldOffset = pageWidth();
    expect(modal.primaryLabel()).toBe('Next');

    // Narrower: the old offset read at the new width would name the last slide.
    mockWindow.width = 200;
    act(() => {
      modal.renderer.update(
        <WhatsNewModal whatsNew={CAROUSEL} isOpen onClose={jest.fn()} initialStep={1} />,
      );
    });
    expect(Math.round(oldOffset / pageWidth())).toBeGreaterThanOrEqual(2);

    // Before the pager is placed at the new width, and right after.
    modal.scrollTo(oldOffset);
    expect(modal.primaryLabel()).toBe('Next');
    modal.layOut();
    expect(mockScrollTo).toHaveBeenLastCalledWith({ x: pageWidth(), animated: false });
    modal.scrollTo(oldOffset);
    expect(modal.primaryLabel()).toBe('Next');
    act(() => modal.renderer.unmount());
  });
});
