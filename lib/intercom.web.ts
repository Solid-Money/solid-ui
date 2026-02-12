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
