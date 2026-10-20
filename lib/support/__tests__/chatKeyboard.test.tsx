import React from 'react';
import { Keyboard, Platform } from 'react-native';

import { androidKeyboardLift, ChatKeyboard, useChatKeyboard } from '@/lib/support/chatKeyboard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

type Listener = (event: { endCoordinates: { height: number } }) => void;

describe('androidKeyboardLift', () => {
  it('lifts by only the keyboard overlap left after the window resizes', () => {
    expect(androidKeyboardLift(300, 24, 0)).toBe(324);
    expect(androidKeyboardLift(300, 24, 200)).toBe(124);
    expect(androidKeyboardLift(300, 24, 324)).toBe(0);
    expect(androidKeyboardLift(287.6, 48, 0)).toBe(336);
  });

  it('stays put with no keyboard, or a floating one', () => {
    expect(androidKeyboardLift(0, 24, 0)).toBe(0);
    expect(androidKeyboardLift(-24, 24, 0)).toBe(0);
  });

  it('never subtracts a bad inset', () => {
    expect(androidKeyboardLift(300, -10, -20)).toBe(300);
  });
});

describe('useChatKeyboard', () => {
  const listeners: Record<string, Listener> = {};
  let seen: ChatKeyboard[] = [];

  const Probe = () => {
    seen.push(useChatKeyboard());
    return null;
  };

  beforeEach(() => {
    seen = [];
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, listener: Listener) => {
      listeners[event] = listener;
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.keys(listeners).forEach(key => delete listeners[key]);
  });

  const withPlatform = (os: typeof Platform.OS, run: () => void) => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    try {
      run();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  };

  it('on Android, follows the keyboard once it is up, and drops to zero when it closes', () => {
    withPlatform('android', () => {
      act(() => {
        create(<Probe />);
      });
      expect(Object.keys(listeners).sort()).toEqual(['keyboardDidHide', 'keyboardDidShow']);
      act(() => listeners.keyboardDidShow({ endCoordinates: { height: 290 } }));
      expect(seen[seen.length - 1]).toEqual({ visible: true, height: 290 });
      act(() => listeners.keyboardDidHide({ endCoordinates: { height: 0 } }));
      expect(seen[seen.length - 1]).toEqual({ visible: false, height: 0 });
    });
  });

  it('on iOS, moves as the keyboard starts to', () => {
    withPlatform('ios', () => {
      act(() => {
        create(<Probe />);
      });
      expect(Object.keys(listeners).sort()).toEqual(['keyboardWillHide', 'keyboardWillShow']);
    });
  });

  it('starts from a keyboard that is already up', () => {
    withPlatform('android', () => {
      jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
      jest
        .spyOn(Keyboard, 'metrics')
        .mockReturnValue({ height: 310, screenX: 0, screenY: 500, width: 400 });
      act(() => {
        create(<Probe />);
      });
      expect(seen[0]).toEqual({ visible: true, height: 310 });
    });
  });
});
