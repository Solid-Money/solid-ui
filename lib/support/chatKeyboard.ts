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
 * Android draws the app edge-to-edge, so the window no longer shrinks for the
 * keyboard: the keyboard covers the bottom of the screen, navigation bar
 * included. React Native's KeyboardAvoidingView works the overlap out from the
 * view's measured position against the keyboard's reported top, and on Android
 * those don't line up reliably: it left the whole message bar under the
 * keyboard, and a gap the size of the system bars after it closed. The
 * keyboard's own height doesn't depend on any of that. Android reports it
 * without the navigation bar the keyboard sits over, so that inset goes back on.
 */
export const androidKeyboardLift = (keyboardHeight: number, navigationBarInset: number): number =>
  keyboardHeight > 0 ? Math.round(keyboardHeight + Math.max(navigationBarInset, 0)) : 0;

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
