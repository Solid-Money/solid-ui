import type { ReactNode } from 'react';

export interface CardSheetBody {
  /** Bumped each time the sheet opens, for state that should reset per visit. */
  session: number;
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
