/** Data required by both the native and web balances sheets. */
export type OtherBalances = {
  walletBalance: number;
  cardBalance: number;
  savingsBalance: number;
  userHasCard: boolean;
  isLoading?: boolean;
};

/** What the Card / Spendable half of the breakdown depends on the issuer for. */
export type CardBalanceDisplay = {
  /** False for a card with no balance of its own — see `cardHoldsBalance`. */
  cardHoldsOwnBalance: boolean;
  /**
   * Whether the Card row offers "Add". Redundant with `cardHoldsOwnBalance` while
   * the two derive from the same rule — a card that holds no balance has no Card
   * row to put a button on — and kept separate so an issuer that holds a balance
   * the app cannot top up needs no new plumbing.
   */
  canAddToCard: boolean;
  /** USD of the user's holdings such a card can spend (`CARD_SPENDABLE_ASSETS`). */
  spendableBalance: number;
};

/**
 * Whether the Card belongs in the breakdown. Shown when the user has an active
 * card OR when there's a card balance to surface — so the balance isn't dropped
 * for testers whose card status isn't ACTIVE yet.
 *
 * A card with no balance of its own is never shown as a Card row: there is no
 * balance on it to report. That user gets the Spendable row instead.
 */
export const shouldShowCard = ({
  cardBalance,
  userHasCard,
  cardHoldsOwnBalance = true,
}: Pick<OtherBalances, 'cardBalance' | 'userHasCard'> &
  Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  cardHoldsOwnBalance && (userHasCard || (cardBalance || 0) > 0);

/**
 * Whether the Spendable row belongs in the breakdown: the user holds a card that
 * carries no balance of its own (Wirex), so what matters is how much of their own
 * money the card can reach.
 */
export const shouldShowSpendable = ({
  userHasCard,
  cardHoldsOwnBalance = true,
}: Pick<OtherBalances, 'userHasCard'> & Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  userHasCard && !cardHoldsOwnBalance;

/** One currency held in the Wirex unified balance. */
export type BankBalance = {
  /** `WEUR` / `WUSD`. */
  tokenSymbol: string;
  amount: number;
  /** The fiat it tracks — `EUR` / `USD`. */
  currency: string;
};

/**
 * The bank balances worth a row: anything the user actually holds.
 *
 * A zero is dropped rather than shown, because both rails report a balance once
 * either is provisioned — a €0.00 row beside a funded $ row reads as money lost,
 * the same reason a $0 Card row is never shown beside a funded Spendable one.
 *
 * An empty input means UNKNOWN, not zero: the backend returns no balances when
 * Wirex could not be reached, so there is nothing to show either way.
 */
export const bankBalancesToShow = (balances: BankBalance[] = []): BankBalance[] =>
  balances.filter(balance => Number.isFinite(balance?.amount) && balance.amount > 0);

/**
 * Everything the user holds, and the home headline: Wallet + Card + Savings.
 *
 * The Wirex bank balance is deliberately NOT part of it. Two reasons, and the
 * first is sufficient on its own:
 *
 *  - It is denominated in EUR as well as USD. Every other figure here is USD, so
 *    adding WEUR would need a live rate, and a rate fetch that fails or goes
 *    stale would silently mis-state the single most important number on the home
 *    screen. Adding only WUSD and not WEUR would be worse — inexplicable to
 *    anyone holding both.
 *  - It is not money the rest of the app can move: it sits in Wirex's custody,
 *    reachable only through a Wirex outbound transfer, so a headline that
 *    included it would overstate what the user can actually do from here.
 *
 * It gets its own row instead, which says the amount in its own currency.
 *
 * Card is only added when it is a pot of its own. For a Wirex card the reported
 * balance is spending power — the wallet and savings the card can reach, seen from
 * the card's side — and adding it would count the same money twice, inflating the
 * headline by however much the card could spend. Spendable never enters a total for
 * the same reason.
 *
 * Note that it now straddles two rows above it rather than one: the card settles
 * from USDC and USDT (Wallet) as well as soUSD (Savings), so it is a reading of both
 * pots, not a share of Savings alone.
 */
export const getTotalBalance = ({
  walletBalance,
  cardBalance,
  savingsBalance,
  userHasCard,
  cardHoldsOwnBalance = true,
}: Omit<OtherBalances, 'isLoading'> & Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>>) =>
  (walletBalance || 0) +
  (shouldShowCard({ cardBalance, userHasCard, cardHoldsOwnBalance }) ? cardBalance || 0 : 0) +
  (savingsBalance || 0);

/**
 * Whether the home action row shows Swap and Send beside "Add Funds".
 *
 * It used to ask only whether the *wallet* had ever been funded — a deposit on
 * record, a token balance, or a vault balance. A cardholder who funds their card
 * directly (the card's own deposit address, which never touches their Safe)
 * satisfies none of those, so a user holding money on their card opened the app
 * to a single "Add Funds" button and two features that had silently disappeared.
 * That is the support report this predicate exists to answer.
 *
 * So the question is "does this person hold anything with us", across every pot
 * the breakdown shows. `depositCompleted` stays in front of it because it answers
 * the same question from history rather than from balances, and survives a
 * balance query that is erroring or briefly empty.
 *
 * Swap and Send work off wallet tokens, so a card-only balance opens them on an
 * empty asset list — which is why that list says so and points at Add Funds.
 * A named action doing little is still a better answer than a home screen that
 * quietly drops it: the user in the report could see their balance and had no way
 * to tell what had happened to the buttons.
 */
export const holdsFundsAnywhere = ({
  depositCompleted,
  ...balances
}: Omit<OtherBalances, 'isLoading'> &
  Partial<Pick<CardBalanceDisplay, 'cardHoldsOwnBalance'>> & {
    /** Wallet funding proven by history: a deposit, a token, a vault balance. */
    depositCompleted: boolean;
  }): boolean => depositCompleted || getTotalBalance(balances) > 0;
