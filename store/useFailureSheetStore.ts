import { create } from 'zustand';

import type { ErrorAction } from '@/lib/errors/actions';
import type { ErrorDetails } from '@/lib/errors/classify';
import type { ErrorReport } from '@/lib/errors/report';

/** What the failure sheet shows. Built by `showFailureSheet`, never by hand. */
export interface FailureSheetContent {
  action: ErrorAction;
  code: string;
  title: string;
  body: string;
  /**
   * False when the transaction may already have gone out (we stopped waiting
   * for it, or it reverted on-chain): the sheet then offers the activity list
   * instead of Try again, so nobody sends the same money twice.
   */
  nothingSent?: boolean;
  /** Absent for failures we don't report (offline, session expired). */
  report?: ErrorReport;
  details?: ErrorDetails;
  /** Shown as the primary button when the action can simply be run again. */
  onRetry?: () => void;
  retryLabel?: string;
}

interface FailureSheetState {
  isOpen: boolean;
  content?: FailureSheetContent;
  open: (content: FailureSheetContent) => void;
  close: () => void;
}

/**
 * One failure sheet for the whole app, mounted once in `DeferredModalProviders`
 * like the support drawer. A new failure replaces the one on screen: two
 * stacked sheets about the same broken flow help nobody.
 */
export const useFailureSheetStore = create<FailureSheetState>()(set => ({
  isOpen: false,
  content: undefined,
  open: content => set({ isOpen: true, content }),
  // Content stays until the next open so the sheet can animate out with it.
  close: () => set({ isOpen: false }),
}));

export const closeFailureSheet = () => useFailureSheetStore.getState().close();
