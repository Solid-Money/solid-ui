import React from 'react';

import CardHeroOverlay from '@/components/Card/NewCardDetails/CardHeroOverlay';
import { useCardHeroStore } from '@/store/useCardHeroStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/components/Card/NewCardDetails/NewCardArt', () => 'CardArt');
jest.mock('@/components/Card/NewCardDetails/heroMotion', () => ({
  CARD_FLIGHT_DURATION: 620,
  EASE_OUT_EXPO: (value: number) => value,
}));
jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    runOnJS: (callback: any) => callback,
    useAnimatedStyle: (style: any) => style(),
    withTiming: (target: number, config: any, callback: any) => ({ target, config, callback }),
    useSharedValue: (initial: number) => {
      const ref = React.useRef(null);
      if (!ref.current) {
        let current = initial;
        let timer: ReturnType<typeof setTimeout>;
        ref.current = {
          get value() {
            return current;
          },
          set value(next: any) {
            clearTimeout(timer);
            if (typeof next === 'number') {
              current = next;
              return;
            }
            // Native Reanimated valueSetter immediately completes no-op timings.
            if (current === next.target) {
              next.callback?.(true);
              return;
            }
            timer = setTimeout(() => {
              current = next.target;
              next.callback?.(true);
            }, next.config.duration);
          },
        };
      }
      return ref.current;
    },
  };
});

const wallet = { x: 0, y: 420, width: 400, height: 258 };
const details = { ...wallet, y: 120 };
let root: any;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  useCardHeroStore.getState().end();
  act(() => {
    root = create(<CardHeroOverlay />);
  });
});

afterEach(() => {
  act(() => root.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('keeps equal-width opening and back flights visible for the full movement', () => {
  for (const [from, to] of [
    [wallet, details],
    [details, wallet],
    [wallet, details],
  ]) {
    act(() => useCardHeroStore.getState().start(from, to, ''));
    expect(useCardHeroStore.getState().active).toBe(true);
    act(() => jest.advanceTimersByTime(619));
    expect(useCardHeroStore.getState().active).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(useCardHeroStore.getState().active).toBe(false);
  }
});

it('does not let an interrupted opening end the return flight early', () => {
  act(() => useCardHeroStore.getState().start(wallet, details, ''));
  act(() => jest.advanceTimersByTime(200));
  act(() => useCardHeroStore.getState().start(details, wallet, ''));
  act(() => jest.advanceTimersByTime(420));
  expect(useCardHeroStore.getState().active).toBe(true);
  act(() => jest.advanceTimersByTime(200));
  expect(useCardHeroStore.getState().active).toBe(false);
});
