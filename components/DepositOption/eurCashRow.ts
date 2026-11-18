import type { VirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';

/**
 * What the cash list's EUR row does.
 *
 * - `bank-account`: the user's own Wirex IBAN.
 * - `ask-residence`: routing guessed a provider from where the phone is, but
 *   where the user lives would decide it — ask first, then open the IBAN for an
 *   IBAN country or the onramp anywhere else. Asked here whichever way the
 *   guess went: a Wirex guess opened straight away would ask on the IBAN screen
 *   instead, and send a non-IBAN answer to the Rain USD account rather than to
 *   euros. This is the row someone who only wants a euro account taps, so the
 *   question belongs here and not behind USD or card onboarding.
 * - `onramp`: buy with euros through TransFi, as for every other currency.
 */
export type EurCashRowMode = 'bank-account' | 'ask-residence' | 'onramp';

export function resolveEurCashRow({
  provider,
  residenceRequired,
  countryPickedByHand,
}: {
  provider: VirtualAccountProvider;
  residenceRequired: boolean;
  countryPickedByHand: boolean;
}): EurCashRowMode {
  // `loading` stays on the onramp so the row does not swap under a finger.
  if (provider === 'loading') return 'onramp';
  if (residenceRequired && !countryPickedByHand) return 'ask-residence';
  return provider === 'wirex' ? 'bank-account' : 'onramp';
}
