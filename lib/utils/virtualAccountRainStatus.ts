import { CardStatusResponse, RainApplicationStatus } from '@/lib/types';

/**
 * The Rain application state that governs the USD virtual account.
 *
 * Read off the RAIN card-customer row (`rainApplication`) first, because that is
 * the row the server opens the account against (`findRainByUserId` in
 * `OnrampAutomationsService.createForUser`). The flat `rainApplicationStatus`
 * comes from the PRIMARY row, which for a Wirex cardholder is their Wirex card
 * and carries no Rain fields at all.
 *
 * Reading only the flat field is what stranded Wirex cardholders Rain had
 * already approved: the apply button saw "not started", found an established
 * Rain consumer, and parked them on the passive pending page instead of the
 * terms step that actually creates the account. For a Rain cardholder both
 * fields come from the same row, so the order changes nothing for them; the
 * flat field remains the fallback for a server that predates `rainApplication`.
 */
export const getVirtualAccountRainStatus = (
  cardStatus: CardStatusResponse | null | undefined,
): RainApplicationStatus | string | undefined =>
  cardStatus?.rainApplication?.status ?? cardStatus?.rainApplicationStatus;

/** Whether Rain has approved this user for the virtual account. */
export const isVirtualAccountRainApproved = (
  cardStatus: CardStatusResponse | null | undefined,
): boolean => getVirtualAccountRainStatus(cardStatus) === RainApplicationStatus.APPROVED;
