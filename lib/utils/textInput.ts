import { Platform } from 'react-native';

/**
 * The members of a text-input ref this helper touches. Native and web hand back
 * different objects — a Fabric `ReactNativeElement` and a DOM `<input>` — and
 * each carries only some of these.
 */
export type TextInputScrollTarget = {
  setSelection?: (start: number, end: number) => void;
  setSelectionRange?: (start: number, end: number) => void;
  scrollLeft?: number;
};

/**
 * Scrolls an amount field back to its first character.
 *
 * A "Max" button fills the field with a full-precision balance — up to 18
 * decimals — which is far wider than the input on a phone. Left alone the field
 * keeps its caret at the end and shows only the trailing decimals, so the amount
 * reads as gibberish. Pulling the caret and the scroll offset back to the start
 * keeps the leading digits, the ones the user cares about, in view.
 *
 * Native must not be handled as a DOM node. Under Fabric the ref is a
 * `ReactNativeElement`, which inherits DOM-shaped accessors such as `scrollLeft`
 * as getters with no setter: they answer `'scrollLeft' in ref` with true and then
 * throw `TypeError: Cannot assign to property 'scrollLeft' which has only a
 * getter` on assignment. Feature-detecting with `in` therefore reads as "web"
 * on Android and crashed the app straight out of a Max tap, so the platform
 * decides which branch runs.
 */
export const showTextInputFromStart = (input: TextInputScrollTarget | null | undefined): void => {
  if (!input) return;

  if (Platform.OS !== 'web') {
    input.setSelection?.(0, 0);
    return;
  }

  if (typeof input.setSelectionRange === 'function') {
    try {
      input.setSelectionRange(0, 0);
    } catch {
      // Some browsers throw on number-ish inputs; the scroll reset below still applies.
    }
  }
  input.scrollLeft = 0;
};
