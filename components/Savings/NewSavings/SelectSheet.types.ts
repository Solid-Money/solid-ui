import type React from 'react';

/** Shared prop contract for the native (bottom sheet) and web (dialog) SelectSheet. */
export type SelectSheetProps = {
  /** The pill/button that opens the sheet. Must forward props + ref (see pills). */
  trigger: React.ReactElement<{ onPress?: () => void }>;
  /** Sheet heading. */
  title: string;
  /** Sheet body. Receives `dismiss` so rows/buttons can close on selection. */
  children: (dismiss: () => void) => React.ReactNode;
};
