import { useIntercom as useIntercomHook } from 'react-use-intercom';

// This file is only loaded on web via Metro platform resolution (.web.ts).
// No Platform.OS guards needed.

export const useIntercom = () => {
  return useIntercomHook();
};

export const openIntercom = () => {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('show');
  }
};

/**
 * Open the chat with a message already typed, without the React provider: for
 * screens that render outside it, such as the root error boundary.
 */
export const openIntercomWithMessage = (message: string) => {
  if (typeof window !== 'undefined' && (window as any).Intercom) {
    (window as any).Intercom('showNewMessage', message);
  }
};
