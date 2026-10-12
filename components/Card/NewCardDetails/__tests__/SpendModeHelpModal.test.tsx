import React from 'react';

import SpendModeHelpModal from '@/components/Card/NewCardDetails/SpendMode/SpendModeHelpModal';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockScrollTo = jest.fn();
const mockClose = jest.fn();
const mockPlayers: {
  replay: jest.Mock;
  pause: jest.Mock;
  seekBy: jest.Mock;
  currentTime: number;
}[] = [];

jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'));
jest.mock('react-native', () => {
  const React = jest.requireActual('react');
  return {
    Modal: 'Modal',
    View: 'View',
    Pressable: 'Pressable',
    Platform: { OS: 'android' },
    useWindowDimensions: () => ({ width: 419, height: 960 }),
    ScrollView: React.forwardRef(function MockScrollView(props: any, ref: any) {
      React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return React.createElement('ScrollView', props);
    }),
  };
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: 'AnimatedView' },
  useAnimatedStyle: (style: () => unknown) => style(),
  useReducedMotion: () => false,
  useSharedValue: (initial: number) =>
    jest.requireActual('react').useRef({ value: initial }).current,
  withTiming: (value: number) => value,
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 24, left: 0 }),
}));
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('lucide-react-native', () => ({ ArrowLeft: 'ArrowLeft', X: 'X' }));
jest.mock('@/hooks/useDimension', () => ({ useDimension: () => ({ isScreenMedium: false }) }));
jest.mock('@/components/ui/badge', () => ({ Badge: 'Badge' }));
jest.mock('@/components/ui/button', () => ({ Button: 'Button' }));
jest.mock('@/components/ui/text', () => ({ Text: 'Text' }));
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (source: number, setup: (player: unknown) => void) => {
    const React = jest.requireActual('react');
    const ref = React.useRef(null);
    if (!ref.current) {
      ref.current = {
        source,
        replay: jest.fn(),
        pause: jest.fn(),
        seekBy: jest.fn(),
        currentTime: 0,
      };
      setup(ref.current);
      mockPlayers.push(ref.current);
    }
    return ref.current;
  },
}));

let tree: any;
const render = (isOpen: boolean) => {
  act(() => {
    const content = <SpendModeHelpModal isOpen={isOpen} onClose={mockClose} />;
    if (tree) tree.update(content);
    else tree = create(content);
  });
};
const present = () => act(() => tree.root.findByType('Modal').props.onShow());
const next = () => act(() => tree.root.findByType('Button').props.onPress());
const scroll = (page: number) =>
  act(() =>
    tree.root.findByType('ScrollView').props.onScroll({
      nativeEvent: { contentOffset: { x: page * 419 } },
    }),
  );

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockPlayers.length = 0;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    callback(0);
    return 1;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.restoreAllMocks();
});

test('starts the first illustration once, after the modal is shown', () => {
  render(false);
  render(true);
  expect(mockPlayers).toHaveLength(3);
  expect(mockPlayers.every(player => player.replay.mock.calls.length === 0)).toBe(true);

  present();
  render(true);
  expect(mockPlayers[0].replay).toHaveBeenCalledTimes(1);
  expect(mockPlayers[1].replay).not.toHaveBeenCalled();
  expect(mockPlayers[2].replay).not.toHaveBeenCalled();
});

test('pauses on close and reopens on the first page after browsing', () => {
  render(true);
  present();
  next();
  scroll(1);
  expect(mockPlayers[1].replay).toHaveBeenCalledTimes(1);

  mockPlayers[1].pause.mockClear();
  render(false);
  expect(mockPlayers[1].pause).toHaveBeenCalled();
  render(true);
  expect(mockPlayers[0].replay).toHaveBeenCalledTimes(1);
  present();
  expect(mockPlayers[0].replay).toHaveBeenCalledTimes(2);
  expect(mockPlayers[1].replay).toHaveBeenCalledTimes(1);
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: false });
});

test('ignores scroll events from the previous opening until presentation finishes', () => {
  render(true);
  present();
  scroll(2);
  render(false);
  scroll(2);
  present();
  render(true);
  scroll(2);
  expect(mockPlayers[0].replay).toHaveBeenCalledTimes(1);
  present();
  expect(mockPlayers[0].replay).toHaveBeenCalledTimes(2);
  expect(mockPlayers[2].replay).toHaveBeenCalledTimes(1);
});

test('keeps navigation working and closes after the final page', () => {
  render(true);
  present();
  next();
  scroll(1);
  next();
  scroll(2);
  next();
  expect(mockPlayers.map(player => player.replay.mock.calls.length)).toEqual([1, 1, 1]);
  expect(mockClose).toHaveBeenCalledTimes(1);
});
