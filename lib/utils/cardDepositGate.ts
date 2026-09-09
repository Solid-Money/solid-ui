import {
  CARD_DEPOSIT_TOLERANCE_USD,
  MINIMUM_CARD_DEPOSIT_CENTS,
  MINIMUM_CARD_DEPOSIT_USD,
} from '@/constants/card';
import { CardProvider } from '@/lib/types';

/**
 * The card minimum-deposit gate, as the client sees it.
 *
 * A leaf module — types and constants only — so these predicates are unit
 * testable: `lib/utils/utils` pulls in AsyncStorage and the API client (and
 * through it Sentry), none of which load under jest-expo. They decide a money
 * gate, so they get direct coverage rather than being exercised only through
 * whatever imports them. Re-exported from `lib/utils/utils`, so `@/lib/utils`
 * remains the import path for every consumer.
 *
 * None of this is the gate itself. The server re-reads the applicant's balance
 * on-chain before it spends anything on their application; these functions only
 * decide what the activation screen shows.
 */

/**
 * Whether this applicant must deposit before their card application is paid for.
 *
 * Keyed on the ISSUER, not on a country. The gate used to be a single-country
 * check (Bangladesh) run against a client-detected country — which meant a VPN
 * turned it off. Every jurisdiction Rain serves is gated now, so there is no
 * country left to move between; Wirex (no per-applicant cost to us, and its card
 * spends soUSD in place rather than being prefunded) and the deprecated
 * bridge.xyz card are outside it.
 *
 * `depositRequired` from `/cards/status` is the authoritative answer and is
 * preferred whenever the backend has one. `issuer` is the fallback for the
 * screens that render before a card customer exists (getCardStatus 404s then).
 * An unresolved issuer shows the step: the Rain flow is the default, and the
 * server refuses the application anyway — showing the step to someone who turns
 * out not to need it is a far smaller cost than hiding it from someone who does
 * and letting them hit a refusal they were never warned about.
 *
 * This only decides what is DISPLAYED. Enforcement is server-side, on the
 * verification session and on the application submission.
 */
export const requiresCardDeposit = ({
  depositRequired,
  issuer,
}: {
  depositRequired?: boolean | null;
  issuer?: CardProvider | null;
}): boolean => {
  if (typeof depositRequired === 'boolean') return depositRequired;
  return issuer !== CardProvider.WIREX && issuer !== CardProvider.BRIDGE;
};

/** Whether the user has deposited at least the minimum required collateral (cents). */
export const hasMetCardDeposit = (depositedCents: number | null | undefined): boolean =>
  (depositedCents ?? 0) >= MINIMUM_CARD_DEPOSIT_CENTS;

/**
 * Whether the user holds at least the minimum required amount in the savings
 * (soUSD) vault — the deposit step's completion condition, evaluated before any
 * card exists.
 *
 * `minimumUsd` comes from `/cards/status.minimumDepositUsd` where available, so
 * the bar can move without an app release; {@link MINIMUM_CARD_DEPOSIT_USD} is
 * the fallback. The tolerance absorbs bridge fees and share-rate rounding so a
 * genuine deposit is not left a few cents short.
 *
 * This mirrors what the backend checks, but it is not the check that matters:
 * the server re-reads the balance on-chain before spending anything.
 */
export const hasMetSavingsDeposit = (
  savingsUsd: number | null | undefined,
  minimumUsd: number = MINIMUM_CARD_DEPOSIT_USD,
): boolean => (savingsUsd ?? 0) >= minimumUsd - CARD_DEPOSIT_TOLERANCE_USD;
