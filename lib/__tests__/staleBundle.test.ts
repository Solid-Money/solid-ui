/// <reference types="jest" />

import { Platform } from 'react-native';

import { isStaleBundleError, reloadForNewBundle } from '@/lib/staleBundle';

const withPlatform = (os: string, run: () => void) => {
  const original = Platform.OS;
  (Platform as { OS: string }).OS = os;
  try {
    run();
  } finally {
    (Platform as { OS: string }).OS = original;
  }
};

/** Verbatim from the August error-boundary data, chunk hash and all. */
const AUGUST_ERROR = {
  name: 'AsyncRequireError',
  message:
    'Loading module https://app.solid.xyz/_expo/static/js/web/WhatsNewModal-3ba83004cb94ee307334b093a29e663e.js failed.\n(error: https://app.solid.xyz/_expo/static/js/web/WhatsNewModal-3ba83004cb94ee307334b093a29e663e.js)',
};

describe('isStaleBundleError', () => {
  it('recognises the AsyncRequireError seen in production', () => {
    withPlatform('web', () => {
      expect(isStaleBundleError(AUGUST_ERROR)).toBe(true);
    });
  });

  it('recognises the other bundlers’ wording for a failed dynamic import', () => {
    withPlatform('web', () => {
      expect(isStaleBundleError(new Error('Loading chunk 42 failed.'))).toBe(true);
      expect(
        isStaleBundleError(new Error('Failed to fetch dynamically imported module: /a.js')),
      ).toBe(true);
      expect(isStaleBundleError({ name: 'ChunkLoadError', message: '' })).toBe(true);
      expect(isStaleBundleError(new Error('Importing a module script failed.'))).toBe(true);
    });
  });

  it('leaves ordinary app errors to the normal error screen', () => {
    withPlatform('web', () => {
      expect(isStaleBundleError(new Error('undefined is not a function'))).toBe(false);
      expect(isStaleBundleError(new TypeError('Cannot read properties of undefined'))).toBe(false);
      expect(isStaleBundleError(null)).toBe(false);
      expect(isStaleBundleError(undefined)).toBe(false);
      expect(isStaleBundleError({})).toBe(false);
    });
  });

  it('never claims a stale bundle on native, where the JS ships with the app', () => {
    for (const os of ['android', 'ios']) {
      withPlatform(os, () => {
        expect(isStaleBundleError(AUGUST_ERROR)).toBe(false);
      });
    }
  });
});

describe('reloadForNewBundle', () => {
  it('does nothing on native', async () => {
    const original = Platform.OS;
    (Platform as { OS: string }).OS = 'android';
    try {
      await expect(reloadForNewBundle()).resolves.toBeUndefined();
    } finally {
      (Platform as { OS: string }).OS = original;
    }
  });
});
