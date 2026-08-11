import { resolveCountryAccess } from '@/lib/countryAccess';

/**
 * Outcome of the card country gate.
 *
 * - `supported` — the country is known and the card is available there, so the
 *   caller can continue straight into the card / KYC flow.
 * - `needs_selection` — the country is unknown, undetectable or unsupported, so
 *   the caller must send the user to the country selection screen
 *   (`path.CARD_COUNTRY_SELECTION`) before anything else.
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
 * @param source analytics label for the entry point that ran the gate
 */
export const resolveCardCountry = async (source?: string): Promise<CardCountryGateResult> => {
  const access = await resolveCountryAccess('card', source);

  return access?.isAvailable ? 'supported' : 'needs_selection';
};
