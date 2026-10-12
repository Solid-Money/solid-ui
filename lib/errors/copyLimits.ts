/**
 * Hard caps on error copy, in characters.
 *
 * Toasts are a title plus at most two lines of body (Figma: Toast component;
 * Material and Carbon cap snackbars at two lines too). At 15/14px Mona Sans a
 * 360pt-wide phone fits roughly 32 title and 38 body characters per line, so
 * these keep the title to one line in practice and the body to two. The
 * components also cap lines (`numberOfLines`), so an over-long string wraps and
 * ellipsizes instead of overflowing; these limits exist so it rarely has to.
 */
export const ERROR_COPY_LIMITS = {
  toastTitle: 48,
  toastBody: 90,
  /** One or two words: Undo, View, Get help. */
  toastAction: 12,
  sheetTitle: 40,
  sheetBody: 140,
  buttonLabel: 20,
} as const;

/**
 * Cut `text` to `max` characters, at a word boundary when one is close, with an
 * ellipsis. In development it warns, because copy that needs cutting is copy
 * that should be rewritten.
 */
export const clampText = <T extends string | undefined>(text: T, max: number): T => {
  if (!text || text.length <= max) return text;
  if (__DEV__) {
    console.warn(`[errors] Copy over ${max} characters was shortened: "${text}"`);
  }
  const hard = text.slice(0, max - 1);
  const lastSpace = hard.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? hard.slice(0, lastSpace) : hard;
  return `${cut.replace(/[\s.,;:–-]+$/, '')}…` as T;
};
