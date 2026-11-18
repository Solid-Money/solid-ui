/**
 * Query params on the wallet screen (`/`) that open something over it.
 *
 * Home is one screen, but several things a link wants to land on live on top of
 * it rather than at a route of their own: the What's New popup, the deposit
 * sheet, the card's spend-mode selector. Each is addressable here as a one-shot
 * param, the same way `?screen=card-info` opens the card pane, so a push, an
 * email CTA and a pasted web link all reach the same place.
 *
 * Push routing (`routeForLink`) and the wallet screen both read them through
 * {@link parseHomeLinkAction}, so a link means the same thing however it
 * arrived. Anything that does not parse is ignored and the link opens plain
 * Home: a malformed or stale link is a reason to land on the wallet, never a
 * reason to open the wrong sheet.
 */

/** `?whatsNew=<id>` opens that What's New announcement. */
export const WHATS_NEW_PARAM = 'whatsNew';
/**
 * `&whatsNewStep=<n>` opens it on its n-th page (0-based), so a push about the
 * third feature in an announcement lands on the third page, not the first.
 */
export const WHATS_NEW_STEP_PARAM = 'whatsNewStep';
/** `?spendMode=open` opens the card's spend-mode selector (Cash, Credit, Smart). */
export const SPEND_MODE_PARAM = 'spendMode';
/** `?deposit=open|cash` opens the deposit sheet, on its first step or on cash. */
export const DEPOSIT_PARAM = 'deposit';

export const HOME_LINK_PARAMS = [
  WHATS_NEW_PARAM,
  WHATS_NEW_STEP_PARAM,
  SPEND_MODE_PARAM,
  DEPOSIT_PARAM,
] as const;

export type HomeLinkParam = (typeof HOME_LINK_PARAMS)[number];

/**
 * Where a `?deposit=` link lands. `open` is the "Deposit with" chooser; `cash`
 * is its cash branch — the EUR bank account and the USD virtual account — which
 * is where a bank-transfer campaign wants people, with the residence and
 * provider checks that screen already makes.
 */
export const DEPOSIT_LINK_TARGETS = ['open', 'cash'] as const;
export type DepositLinkTarget = (typeof DEPOSIT_LINK_TARGETS)[number];

export type HomeLinkAction =
  | { kind: 'whats-new'; id: string; step: number }
  | { kind: 'deposit'; target: DepositLinkTarget }
  | { kind: 'spend-mode' };

/** A Mongo ObjectId, which is what What's New announcements are keyed by. */
const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** Far more pages than an announcement has; it only bounds a hand-edited link. */
const MAX_STEP = 49;

const parseStep = (raw: string | undefined): number => {
  if (!raw || !/^\d{1,2}$/.test(raw)) return 0;
  return Math.min(Number(raw), MAX_STEP);
};

/**
 * The one thing a set of Home params asks for, or undefined when they ask for
 * nothing this screen knows.
 *
 * Takes a getter so it reads `URLSearchParams` (a push link) and expo-router's
 * params (a link that has already been routed) alike. A repeated param arrives
 * from the router as an array; only a single value is honoured.
 */
export function parseHomeLinkAction(
  get: (param: HomeLinkParam) => string | string[] | null | undefined,
): HomeLinkAction | undefined {
  const read = (param: HomeLinkParam) => {
    const value = get(param);
    return typeof value === 'string' ? value : undefined;
  };

  const whatsNewId = read(WHATS_NEW_PARAM);
  if (whatsNewId && OBJECT_ID.test(whatsNewId)) {
    return { kind: 'whats-new', id: whatsNewId, step: parseStep(read(WHATS_NEW_STEP_PARAM)) };
  }

  const deposit = read(DEPOSIT_PARAM);
  if (deposit && (DEPOSIT_LINK_TARGETS as readonly string[]).includes(deposit)) {
    return { kind: 'deposit', target: deposit as DepositLinkTarget };
  }

  if (read(SPEND_MODE_PARAM) === 'open') return { kind: 'spend-mode' };

  return undefined;
}

/** The params that carry `action`, for building an Href onto the wallet screen. */
export function homeLinkParamsFor(action: HomeLinkAction): Partial<Record<HomeLinkParam, string>> {
  switch (action.kind) {
    case 'whats-new':
      return { [WHATS_NEW_PARAM]: action.id, [WHATS_NEW_STEP_PARAM]: String(action.step) };
    case 'deposit':
      return { [DEPOSIT_PARAM]: action.target };
    case 'spend-mode':
      return { [SPEND_MODE_PARAM]: 'open' };
  }
}
