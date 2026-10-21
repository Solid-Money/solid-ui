import type { VirtualAccountProvider } from '@/hooks/useVirtualAccountProvider';

/**
 * What the cash list's EUR row does.
 *
 * - `bank-account`: the user's own Wirex IBAN.
 * - `ask-residence`: routing guessed Rain from where the phone is, but where the
 *   user lives would decide it — ask first, then open the IBAN for an IBAN
 *   country or the onramp anywhere else. This is the row someone who only
 *   wants a euro account taps, so the question belongs here and not behind
 *   USD or card onboarding.
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
  if (provider === 'wirex') return 'bank-account';
  if (provider === 'rain' && residenceRequired && !countryPickedByHand) return 'ask-residence';
  // `loading` stays on the onramp so the row does not swap under a finger.
  return 'onramp';
}
