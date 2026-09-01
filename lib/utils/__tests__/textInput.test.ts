/// <reference types="jest" />

import { Platform } from 'react-native';

import { showTextInputFromStart } from '@/lib/utils/textInput';

/**
 * Stands in for the ref React Native hands back under Fabric: a
 * `ReactNativeElement`, whose DOM-shaped accessors are getters with no setter.
 * `'scrollLeft' in ref` is true and assigning to it throws — the crash a Max tap
 * used to trigger on Android.
 */
const nativeRef = () => {
  const ref = { setSelection: jest.fn() };
  Object.defineProperty(ref, 'scrollLeft', { get: () => 0, configurable: true });
  return ref;
};

/** Stands in for the DOM input react-native-web forwards its ref to. */
const webRef = () => ({ setSelectionRange: jest.fn(), scrollLeft: 120 });

const withPlatform = (os: string, run: () => void) => {
  const original = Platform.OS;
  // Platform.OS is a plain property on the module object, so tests set it directly.
  (Platform as { OS: string }).OS = os;
  try {
    run();
  } finally {
    (Platform as { OS: string }).OS = original;
  }
};

describe('showTextInputFromStart', () => {
  it('never assigns to a read-only scrollLeft on native', () => {
    withPlatform('android', () => {
      const ref = nativeRef();

      expect(() => showTextInputFromStart(ref)).not.toThrow();
      expect(ref.setSelection).toHaveBeenCalledWith(0, 0);
    });
  });

  it('leaves the DOM-only calls alone on native even when the ref exposes them', () => {
    withPlatform('ios', () => {
      const ref = { ...nativeRef(), setSelectionRange: jest.fn() };

      showTextInputFromStart(ref);

      expect(ref.setSelectionRange).not.toHaveBeenCalled();
    });
  });

  it('resets caret and scroll offset on web', () => {
    withPlatform('web', () => {
      const ref = webRef();

      showTextInputFromStart(ref);

      expect(ref.setSelectionRange).toHaveBeenCalledWith(0, 0);
      expect(ref.scrollLeft).toBe(0);
    });
  });

  it('still scrolls to the start when a browser rejects setSelectionRange', () => {
    withPlatform('web', () => {
      const ref = {
        setSelectionRange: jest.fn(() => {
          throw new Error('not supported on inputs of type number');
        }),
        scrollLeft: 120,
      };

      expect(() => showTextInputFromStart(ref)).not.toThrow();
      expect(ref.scrollLeft).toBe(0);
    });
  });

  it('does nothing when the field has already unmounted', () => {
    withPlatform('android', () => {
      expect(() => showTextInputFromStart(null)).not.toThrow();
      expect(() => showTextInputFromStart(undefined)).not.toThrow();
    });
  });
});
