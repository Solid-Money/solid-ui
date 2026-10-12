import { CardStatusResponse, KycStatus, RainApplicationStatus } from '@/lib/types';
import { getVirtualAccountRainStatus } from '@/lib/utils/virtualAccountRainStatus';

/**
 * What a user on `/card/pending` in the virtual-account flow is actually
 * waiting on.
 *
 * That page is the virtual account's terminus — `resolveCardPendingDestination`
 * never navigates a `va` user away — and it used to show one passive "you will
 * be notified by mail" screen for every outcome. Approved, denied, declined by
 * Didit and held on the deposit gate all looked identical, and none of them
 * would ever change on their own:
 *
 *  - `approved`: Rain said yes; the account is opened by accepting the terms,
 *    which only the user can do.
 *  - `denied`: Rain said no (or locked/cancelled the application).
 *  - `verification-declined`: Didit declined the identity check before anything
 *    reached Rain, so the user may verify again.
 *  - `deposit-required`: Didit approved, but the hand-off to Rain is held until
 *    the minimum savings deposit is held.
 *  - `waiting`: a decision genuinely still to come.
 *
 * Rain's own "needs verification / needs information" step is not here: the
 * page already renders a CTA for it, for both flows, before consulting this.
 *
 * Reads the Rain row (`rainApplication`) rather than the flat fields, which come
 * from the primary row — for a Wirex cardholder, their Wirex card.
 */
export type VirtualAccountPendingState =
  | 'approved'
  | 'denied'
  | 'verification-declined'
  | 'deposit-required'
  | 'waiting';

const DENIED_RAIN_STATUSES: readonly string[] = [
  RainApplicationStatus.DENIED,
  RainApplicationStatus.LOCKED,
  RainApplicationStatus.CANCELED,
];

export function resolveVirtualAccountPendingState(
  cardStatus: CardStatusResponse | null | undefined,
): VirtualAccountPendingState {
  if (!cardStatus) return 'waiting';

  const rainStatus = getVirtualAccountRainStatus(cardStatus);
  if (rainStatus === RainApplicationStatus.APPROVED) return 'approved';
  if (rainStatus && DENIED_RAIN_STATUSES.includes(rainStatus)) return 'denied';

  const rainRow = cardStatus.rainApplication;

  // A Didit decline happens before anything is sent to Rain, so there is no
  // Rain status and no Rain consumer. Requiring both keeps a Rain-side outcome
  // (which also writes `rejected`) from being offered a fresh identity check
  // the server would refuse.
  if (
    rainRow?.kycStatus === KycStatus.REJECTED &&
    !rainStatus &&
    !cardStatus.rainKycApplicationEstablished
  ) {
    return 'verification-declined';
  }

  if (rainRow?.forwardPendingDeposit === true) return 'deposit-required';

  return 'waiting';
}
