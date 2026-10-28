import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export type ChatKeyboard = {
  /** The keyboard is up (iOS: about to be, so the message bar moves with it). */
  visible: boolean;
  /** Its height as React Native reports it; on Android that leaves out the navigation bar. */
  height: number;
};

const HIDDEN: ChatKeyboard = { visible: false, height: 0 };

const current = (): ChatKeyboard => {
  if (Platform.OS === 'web' || !Keyboard.isVisible()) return HIDDEN;
  return { visible: true, height: Keyboard.metrics()?.height ?? 0 };
};

/**
 * How far the support chat lifts its message bar while the Android keyboard is up.
 *
 * Some Android windows resize for the keyboard even when the app draws edge to
 * edge. Only the part of the keyboard that still overlaps the resized window
 * needs padding. The keyboard height omits the navigation bar it covers, so
 * include that inset before subtracting the window's resize.
 */
export const androidKeyboardLift = (
  keyboardHeight: number,
  navigationBarInset: number,
  windowResize: number,
): number =>
  keyboardHeight > 0
    ? Math.max(
        0,
        Math.round(keyboardHeight + Math.max(navigationBarInset, 0) - Math.max(windowResize, 0)),
      )
    : 0;

/** Whether the keyboard is up, and how tall it is, for the support chat. */
export const useChatKeyboard = (): ChatKeyboard => {
  const [keyboard, setKeyboard] = useState<ChatKeyboard>(current);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', event =>
      setKeyboard({ visible: true, height: event.endCoordinates.height }),
    );
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboard(HIDDEN),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return keyboard;
};
