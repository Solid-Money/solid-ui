import type { WalletTopUpQuoteResponse, WalletTopUpSdkConfig } from '@/lib/types/wallet-topup';

/**
 * What Wirex's checkout reports, in one vocabulary for both platforms. The native
 * view sends events and the web frame calls callbacks; each platform file maps
 * its own onto these.
 */
export interface WalletCheckoutHandlers {
  /** The Pay sheet opened. */
  onSheetOpen: () => void;
  /** The user closed the sheet. Nothing happened; the button stays usable. */
  onCancel: () => void;
  /** The sheet opened but produced nothing. Nothing was charged; the button stays usable. */
  onAttemptFailed: (reason: string) => void;
  /** The quote ran out on screen: fetch a fresh one (and token) to re-arm. */
  onEstimationExpired: () => void;
  /** The checkout executed the top-up; its status is the backend's to report. */
  onExecuted: (result: { id: string; status: string }) => void;
  /** The checkout's execute call failed; money may still have moved for some reasons. */
  onExecuteFailed: (error: { reason: string; status?: number }) => void;
  /** Nothing more will come from this checkout: it did not load. */
  onLoadFailed: (kind: string) => void;
  /** Web, desktop: the QR handed the payment to a phone. Only the status says how it went. */
  onHandoffPending: () => void;
}

export interface WalletCheckoutProps {
  sdk: WalletTopUpSdkConfig;
  /** The quote and its checkout token. A new `estimationId` re-arms the checkout in place. */
  checkout: WalletTopUpQuoteResponse;
  /** Memoised by the caller. */
  handlers: WalletCheckoutHandlers;
}
