import { resolveCountryAccess } from '@/lib/countryAccess';

/**
 * Outcome of the card country gate.
 *
 * - `supported` — the user has told us where they live and the card is
 *   available there, so the caller can continue straight into the card / KYC
 *   flow.
 * - `needs_selection` — the country is unknown, undetectable, unsupported or
 *   only *guessed*, so the caller must send the user to the country selection
 *   screen (`path.CARD_COUNTRY_SELECTION`) before anything else.
 */
export type CardCountryGateResult = 'supported' | 'needs_selection';

/**
 * Resolve the user's card country the same way `/card/activate` does on mount
 * (see `useCountryCheck`), but imperatively — so an entry point that isn't a
 * screen can run the same gate before it navigates.
 *
 * Never throws — any failure means "we can't confirm the country", which hands
 * the decision to the user on the selection screen.
 *
 * An IP-derived country is deliberately NOT enough to pass. It reports where
 * the phone is rather than where the user is resident, and the backend refuses
 * to open a Sumsub card verification on a guess — only a country the user
 * declared may establish `user.country`, which pins their card issuer for good
 * (see `SumsubService.resolveMandatoryCardCountry`). Letting an IP hit pass
 * here is what stranded users: the gate said `supported`, nothing ever asked,
 * and the session then died on COUNTRY_REQUIRED with no way forward.
 *
 * `resolveCountryAccess` persists whatever it detects, so a single visit to any
 * card entry point used to leave a supported IP country in the store and make
 * every later gate pass silently. Keying on `source` closes that too.
 *
 * @param source analytics label for the entry point that ran the gate
 */
export const resolveCardCountry = async (source?: string): Promise<CardCountryGateResult> => {
  const access = await resolveCountryAccess('card', source);

  if (!access?.isAvailable) return 'needs_selection';

  return access.source === 'manual' ? 'supported' : 'needs_selection';
};
