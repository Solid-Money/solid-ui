/**
 * The connection type (wifi, cellular, none, …) as last reported, for the
 * performance samples: a 30-second load on a weak cellular link and one on
 * office wifi are different bugs.
 *
 * NetInfo is loaded on first use, not on import, so modules that only read the
 * value stay importable where the native module isn't available (tests).
 */
let current: string | undefined;
let listening = false;

export const watchNetworkType = (): void => {
  if (listening) return;
  listening = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo')
      .default as typeof import('@react-native-community/netinfo').default;
    NetInfo.addEventListener(state => {
      current = state.type ? String(state.type) : undefined;
    });
  } catch {
    listening = false;
  }
};

export const getNetworkType = (): string | undefined => current;
