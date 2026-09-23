import type { ReactNode } from 'react';

/**
 * Where the body is being drawn.
 *
 * `sheet` is the bottom sheet on native and on phone-width web: Figma's 17pt inset, and no
 * close button, because the handle and a pan down close it. `modal` is the desktop dialog,
 * which brings its own inset and hides its header, so the body draws a compact close button
 * in its own first row instead of the dialog spending a whole row on one.
 */
export type CardSheetPresentation = 'sheet' | 'modal';

/** Side inset of a sheet body: the 385pt content block on Figma's 419pt frame. */
export const SHEET_BODY_INSET = 17;

/** The body's own side inset. The desktop modal already pads its content. */
export const sheetBodyInset = (presentation: CardSheetPresentation = 'sheet'): number =>
  presentation === 'modal' ? 0 : SHEET_BODY_INSET;

export interface CardSheetBody {
  /** Bumped each time the sheet opens, for state that should reset per visit. */
  session: number;
  /** Omitted by the bottom sheets, which is `sheet`. */
  presentation?: CardSheetPresentation;
  /**
   * Padding the body should put above its first element. The drag handle already
   * eats into Figma's measurement on native, and the desktop modal brings its own
   * header padding, so the presentation works this out rather than the body.
   */
  topPadding: number;
}

export interface CardBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Distinguishes this sheet in `ResponsiveModal`'s animation bookkeeping. */
  contentKey: string;
  /** Where Figma puts the body's first element, measured from the sheet's top edge. */
  designTop: number;
  /** Space Figma leaves below the body's last element, before any safe-area inset. */
  designBottom: number;
  children: (body: CardSheetBody) => ReactNode;
}

/** Drag handle: 15pt of padding over a 5pt indicator, on both platforms. */
export const SHEET_HANDLE_PADDING = 15;
export const SHEET_HANDLE_HEIGHT = 5;
export const SHEET_HANDLE_SPACE = SHEET_HANDLE_PADDING + SHEET_HANDLE_HEIGHT;
