import {
  type CardDetailsResponseDto,
  CardProvider,
  CardStatus,
  type CardStatusResponse,
} from '@/lib/types';

/**
 * Predicates that decide where a user in the card flow is routed.
 *
 * Kept in their own leaf module — importing only types — so they can be unit
 * tested directly. `lib/utils/utils` pulls in AsyncStorage and the API client
 * (and through it Sentry), none of which load under jest-expo, which is why
 * routing logic this load-bearing had no test coverage before.
 *
 * Re-exported from `lib/utils/utils`, so `@/lib/utils` remains the import path
 * for every consumer.
 */

/** Rain-first: only Rain cards count as "has card". Bridge-only users are treated as no card. */
export const hasCard = (cardStatus: CardStatusResponse | null | undefined): boolean => {
  if (!cardStatus?.status) return false;
  const isActiveOrFrozen =
    cardStatus.status === CardStatus.ACTIVE || cardStatus.status === CardStatus.FROZEN;
  if (!isActiveOrFrozen) return false;
  return cardStatus.provider !== CardProvider.BRIDGE;
};

export const hasCardStatusWithRainApplication = (
  cardStatus: CardStatusResponse | null | undefined,
): boolean => Boolean(cardStatus?.rainApplicationStatus);

/**
 * A card has been ordered and the issuer hasn't opened it yet.
 *
 * Distinct from `hasCard`, which means "usable card" and so requires
 * active/frozen. A pending card is not usable, but it definitely exists — which
 * matters for routing: sending this user back to country selection or to the
 * consent screen would either restart onboarding they already finished or ask the
 * backend to issue a second card (it refuses, one per provider). They belong on
 * the issuance flow, which shows the "on its way" state and polls until the card
 * opens.
 *
 * This is the state a Wirex virtual card sits in between issuance and the issuer
 * opening it — normally seconds, but indefinitely if the activation webhook is
 * dropped and nothing reconciles against the API.
 */
export const hasPendingCard = (cardStatus: CardStatusResponse | null | undefined): boolean =>
  cardStatus?.status === CardStatus.PENDING && cardStatus.provider !== CardProvider.BRIDGE;

/**
 * Which issuer the user's card is on, or null when they effectively have none.
 *
 * Every consumer branches on `provider === RAIN` to decide whether Rain-only
 * endpoints apply (encrypted card secrets, spending-power balance, funding
 * contracts). Naming the issuer correctly is therefore what keeps a Wirex card
 * off those endpoints — reporting Rain for any non-Bridge card is what made the
 * card-details reveal POST to Rain's `/cards/secrets` and fail.
 *
 * An issuer is only reported once a card exists, so nothing begins
 * issuer-specific fetching while the user is still in KYC.
 */
export const resolveCardIssuer = ({
  cardStatus,
  cardDetails,
  issuerOverride,
}: {
  cardStatus?: CardStatusResponse | null;
  cardDetails?: Pick<CardDetailsResponseDto, 'id' | 'provider'> | null;
  /** EXPO_PUBLIC_CARD_ISSUER — a build-level override for testing. */
  issuerOverride?: CardProvider | null;
}): CardProvider | null => {
  if (issuerOverride) return issuerOverride;

  const hasNonBridgeCard =
    hasCard(cardStatus) || (!!cardDetails?.id && cardDetails?.provider !== CardProvider.BRIDGE);
  if (!hasNonBridgeCard) return null;

  const reported = cardStatus?.provider ?? cardDetails?.provider;
  // Legacy rows predate the provider field; those cards are all Rain.
  return reported && reported !== CardProvider.BRIDGE ? reported : CardProvider.RAIN;
};
