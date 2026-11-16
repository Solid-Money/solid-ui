import {
  CardTransaction,
  CardTransactionCategory,
  Cashback,
  CashbackCurrency,
  CashbackStatus,
  CashbackType,
} from '@/lib/types';
import { CURRENCY_SYMBOLS, getCashbackValue } from '@/lib/utils/cardHelpers';
import {
  getSpendingCategory,
  matchSubscriptionBrand,
  merchantOf,
  SPENDING_CATEGORIES,
  type SpendingCategoryKey,
  type SpendingCategoryMeta,
} from '@/lib/utils/spendingCategories';
import { getCardTransactionTimestamp } from '@/lib/utils/unifiedActivity';

/**
 * Spending insights, worked out on the device from the card history the app
 * already loads (`/cards/transactions`) and the cashback rows it already has
 * (`/cards/cashback`). No backend aggregate exists yet, so everything here is a
 * pure function over those two lists — which also keeps it testable.
 *
 * Month and day boundaries are the phone's local time, which is what the user
 * means by "September".
 */

export {
  getMccCategory,
  getSpendingCategory,
  type MatchedSubscriptionBrand,
  matchSubscriptionBrand,
  SPENDING_CATEGORIES,
  type SpendingCategoryKey,
  type SpendingCategoryMeta,
} from '@/lib/utils/spendingCategories';

/** Statuses that are money spent (or about to be). Declined and reversed are not. */
const COUNTED_STATUSES = new Set(['approved', 'settled', 'pending', 'completed']);

const isCounted = (transaction: CardTransaction): boolean =>
  COUNTED_STATUSES.has((transaction.status ?? '').toLowerCase());

/**
 * What a card row is worth in dollars, as a positive number, or null when it
 * cannot be priced.
 *
 * A non-USD charge (Wirex EUR/GBP cards) carries its dollar value in
 * `usd_amount`. Token symbols in `currency` ("usdc") are dollars already.
 */
export const getTransactionUsdAmount = (
  transaction: Pick<CardTransaction, 'amount' | 'currency' | 'usd_amount'>,
): number | null => {
  const code = transaction.currency?.trim().toUpperCase();
  const isFiat = !!code && /^[A-Z]{3}$/.test(code);
  const source =
    isFiat && code !== 'USD' && transaction.usd_amount
      ? transaction.usd_amount
      : transaction.amount;
  const value = Math.abs(parseFloat(source));
  return Number.isFinite(value) ? value : null;
};

/**
 * The same row can arrive on several pages: for Rain cards every response
 * repeats the newest rows from our own database next to the issuer's page.
 * Later copies win, since they are the fresher read.
 */
export const dedupeTransactions = (transactions: CardTransaction[]): CardTransaction[] => {
  const byId = new Map<string, CardTransaction>();
  for (const transaction of transactions) byId.set(transaction.id, transaction);
  return Array.from(byId.values());
};

// ---------------------------------------------------------------------------
// Dates

/**
 * When a purchase was made, in ms: the authorization, which is the day the user
 * tapped the card. The feed dates a settled row by its posting instead, which
 * would move a purchase made on Aug 31 and settled on Sep 2 into September.
 */
export const getSpendTimestamp = (
  transaction: Pick<CardTransaction, 'authorized_at' | 'posted_at' | 'status'>,
): number => {
  for (const value of [transaction.authorized_at, transaction.posted_at]) {
    const parsed = value ? new Date(value).getTime() : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return getCardTransactionTimestamp(transaction as CardTransaction) * 1000;
};

/** "2026-09" for the local month a timestamp (ms) falls in. */
export const getMonthKey = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const parseMonthKey = (key: string): { year: number; month: number } => {
  const [year, month] = key.split('-').map(Number);
  return { year, month: month - 1 };
};

/** Local midnight on the 1st of the month, in ms. */
export const getMonthStart = (key: string): number => {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month, 1).getTime();
};

export const shiftMonthKey = (key: string, delta: number): string => {
  const { year, month } = parseMonthKey(key);
  return getMonthKey(new Date(year, month + delta, 1).getTime());
};

export const getDaysInMonth = (key: string): number => {
  const { year, month } = parseMonthKey(key);
  return new Date(year, month + 1, 0).getDate();
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const getMonthName = (key: string): string => MONTH_NAMES[parseMonthKey(key).month];
export const getShortMonthName = (key: string): string => getMonthName(key).slice(0, 3);

// ---------------------------------------------------------------------------
// Cashback

/** Rows that stand for cashback the user has, or will have. */
const EARNED_CASHBACK_STATUSES = new Set<CashbackStatus>([
  CashbackStatus.Pending,
  CashbackStatus.Escrowed,
  CashbackStatus.Paid,
  CashbackStatus.DeductedFromDebt,
  CashbackStatus.PartiallyRefunded,
]);

/**
 * A cashback row in its own currency — euros for a EUR row, dollars otherwise:
 * the payout when it has been paid, otherwise the backend's projection, and 0
 * for a row that stands for nothing earned. Mirrors `getCashbackAmount`, which
 * formats the same figure for one receipt.
 *
 * The currency comes with the value because the two are never added together:
 * every total built from these is kept per currency.
 */
export const getEarnedCashbackValue = (
  cashback: Cashback,
): { value: number; currency: CashbackCurrency } => {
  const { value, currency } = getCashbackValue(cashback);
  const earned =
    EARNED_CASHBACK_STATUSES.has(cashback.status) &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0;
  return { value: earned ? value : 0, currency };
};

// ---------------------------------------------------------------------------
// Month summaries

export interface CategorySummary extends SpendingCategoryMeta {
  amount: number;
  count: number;
  /** Share of the month's spend, 0–100, rounded. */
  percent: number;
}

export interface SubscriptionCashbackItem {
  transactionId: string;
  merchant: string;
  /** Backend category key ("ai", "streaming", …); configured server-side. */
  category?: string;
  /** The cashback, in `currency` — the row's own. */
  amount: number;
  currency: CashbackCurrency;
}

export interface SubscriptionItem {
  key: string;
  /** The service's name, or the merchant as the issuer wrote it. */
  merchant: string;
  /** A recognised service, for its logo (see `subscriptionBrands.ts`). */
  brand?: string;
  /** Backend category key ("ai", "streaming", …), when known. */
  category?: string;
  amountUsd: number;
  charges: number;
  lastChargedAt: number;
  /** Cashback actually earned on these charges, per currency (never summed); 0 when none. */
  cashbackUsd: number;
  cashbackEur: number;
}

export interface MonthSummary {
  key: string;
  total: number;
  purchaseCount: number;
  /**
   * Cashback earned on the month's purchases, per currency: USD rows and EUR
   * rows are summed apart and never added together.
   */
  cashbackUsd: number;
  cashbackEur: number;
  /** Largest first, Other always last. Empty categories are left out. */
  categories: CategorySummary[];
  /** Spend per day of the month, index 0 = the 1st. */
  daily: number[];
  subscriptionCashback: SubscriptionCashbackItem[];
  /** Distinct subscription categories that paid cashback this month. */
  subscriptionCategoriesUsed: string[];
  /** Everything charged under Subscriptions this month, one row per service. */
  subscriptions: SubscriptionItem[];
}

export interface SpendingInsights {
  /** Oldest first, ending with the current month. Only months fully covered. */
  months: MonthSummary[];
  currentMonthKey: string;
  /**
   * Month of the oldest purchase, when the whole card history was read and so
   * it is known to be the first. Undefined when older history may exist.
   */
  firstPurchaseMonthKey?: string;
  hasAnyPurchase: boolean;
}

export interface BuildSpendingInsightsOptions {
  now?: number;
  /** How many months before the current one to summarise. */
  monthsBack: number;
  /** True when every page of card history was read. */
  historyComplete: boolean;
}

const emptyMonth = (key: string): MonthSummary => ({
  key,
  total: 0,
  purchaseCount: 0,
  cashbackUsd: 0,
  cashbackEur: 0,
  categories: [],
  daily: Array.from({ length: getDaysInMonth(key) }, () => 0),
  subscriptionCashback: [],
  subscriptionCategoriesUsed: [],
  subscriptions: [],
});

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const buildSpendingInsights = (
  rawTransactions: CardTransaction[],
  cashbacks: Cashback[] | undefined,
  { now = Date.now(), monthsBack, historyComplete }: BuildSpendingInsightsOptions,
): SpendingInsights => {
  const currentMonthKey = getMonthKey(now);
  const transactions = dedupeTransactions(rawTransactions);

  const timestampOf = new Map<string, number>();
  const transactionById = new Map<string, CardTransaction>();
  for (const transaction of transactions) {
    timestampOf.set(transaction.id, getSpendTimestamp(transaction));
    transactionById.set(transaction.id, transaction);
  }

  // Months to report: never before history we have actually read.
  const oldestLoaded = transactions.reduce(
    (min, transaction) => Math.min(min, timestampOf.get(transaction.id) ?? Infinity),
    Infinity,
  );
  const monthKeys: string[] = [];
  for (let offset = monthsBack; offset >= 0; offset--) {
    const key = shiftMonthKey(currentMonthKey, -offset);
    // A month is only complete if history reaches back past its start.
    if (offset === 0 || historyComplete || oldestLoaded < getMonthStart(key)) {
      monthKeys.push(key);
    }
  }
  const months = new Map(monthKeys.map(key => [key, emptyMonth(key)]));

  const subscriptionCashbacks = (cashbacks ?? []).filter(
    cashback => cashback.type === CashbackType.SubscriptionDiscount,
  );
  const subscriptionTransactionIds = new Set(
    subscriptionCashbacks
      .filter(cashback => cashback.status !== CashbackStatus.Ineligible)
      .map(cashback => cashback.transactionId),
  );

  type CategoryTotal = { amount: number; count: number };
  const categoryTotals = new Map<string, Map<SpendingCategoryKey, CategoryTotal>>();
  const subscriptionsByMonth = new Map<string, Map<string, SubscriptionItem>>();
  const subscriptionKeyByTransaction = new Map<string, string>();
  let oldestPurchase = Infinity;
  let hasAnyPurchase = false;

  for (const transaction of transactions) {
    if (!isCounted(transaction)) continue;
    const isPurchase = transaction.category === CardTransactionCategory.PURCHASE;
    const isRefund = transaction.category === CardTransactionCategory.REFUND;
    if (!isPurchase && !isRefund) continue;

    const ms = timestampOf.get(transaction.id) ?? 0;
    if (isPurchase) {
      hasAnyPurchase = true;
      oldestPurchase = Math.min(oldestPurchase, ms);
    }

    const month = months.get(getMonthKey(ms));
    if (!month) continue;
    const usd = getTransactionUsdAmount(transaction);
    if (usd === null || usd === 0) continue;

    const signed = isPurchase ? usd : -usd;
    const category = getSpendingCategory(transaction, subscriptionTransactionIds);
    const day = new Date(ms).getDate() - 1;

    month.total += signed;
    if (isPurchase) month.purchaseCount += 1;
    month.daily[day] = (month.daily[day] ?? 0) + signed;

    if (category === 'subscriptions') {
      const merchant = merchantOf(transaction);
      const brand = matchSubscriptionBrand(merchant);
      const key = brand?.name ?? (merchant.toLowerCase() || transaction.id);
      const items = subscriptionsByMonth.get(month.key) ?? new Map<string, SubscriptionItem>();
      const item = items.get(key) ?? {
        key,
        merchant: brand?.name ?? (merchant || 'Subscription'),
        brand: brand?.name,
        category: brand?.category,
        amountUsd: 0,
        charges: 0,
        lastChargedAt: 0,
        cashbackUsd: 0,
        cashbackEur: 0,
      };
      item.amountUsd += signed;
      if (isPurchase) {
        item.charges += 1;
        item.lastChargedAt = Math.max(item.lastChargedAt, ms);
      }
      items.set(key, item);
      subscriptionsByMonth.set(month.key, items);
      subscriptionKeyByTransaction.set(transaction.id, key);
    }

    const totals = categoryTotals.get(month.key) ?? new Map<SpendingCategoryKey, CategoryTotal>();
    const entry: CategoryTotal = totals.get(category) ?? { amount: 0, count: 0 };
    entry.amount += signed;
    if (isPurchase) entry.count += 1;
    totals.set(category, entry);
    categoryTotals.set(month.key, totals);
  }

  // Cashback lands in the month of the purchase that earned it; a row whose
  // purchase is outside the loaded history falls back to when it was written.
  // Each row is added to the total of its own currency only.
  for (const cashback of cashbacks ?? []) {
    const { value, currency } = getEarnedCashbackValue(cashback);
    if (!value) continue;
    const ms = timestampOf.get(cashback.transactionId) ?? new Date(cashback.createdAt).getTime();
    const month = months.get(getMonthKey(ms));
    if (!month) continue;
    const cashbackKey = currency === 'EUR' ? 'cashbackEur' : 'cashbackUsd';
    month[cashbackKey] += value;

    const subscriptionKey = subscriptionKeyByTransaction.get(cashback.transactionId);
    const subscriptionItem = subscriptionKey
      ? subscriptionsByMonth.get(month.key)?.get(subscriptionKey)
      : undefined;
    if (subscriptionItem) {
      subscriptionItem[cashbackKey] += value;
      // The backend's category beats the one guessed from the name.
      subscriptionItem.category = cashback.subscriptionCategory ?? subscriptionItem.category;
    }

    if (cashback.type === CashbackType.SubscriptionDiscount) {
      const transaction = transactionById.get(cashback.transactionId);
      month.subscriptionCashback.push({
        transactionId: cashback.transactionId,
        merchant:
          cashback.merchantName?.trim() ||
          transaction?.merchant_name?.trim() ||
          transaction?.description?.trim() ||
          'Subscription',
        category: cashback.subscriptionCategory,
        amount: round2(value),
        currency,
      });
      const subscriptionCategory = cashback.subscriptionCategory;
      if (
        subscriptionCategory &&
        !month.subscriptionCategoriesUsed.includes(subscriptionCategory)
      ) {
        month.subscriptionCategoriesUsed.push(subscriptionCategory);
      }
    }
  }

  for (const month of months.values()) {
    month.total = Math.max(0, round2(month.total));
    month.cashbackUsd = round2(month.cashbackUsd);
    month.cashbackEur = round2(month.cashbackEur);
    month.daily = month.daily.map(value => Math.max(0, round2(value)));
    month.subscriptionCashback.sort((a, b) => b.amount - a.amount);
    month.subscriptions = Array.from(subscriptionsByMonth.get(month.key)?.values() ?? [])
      .map(item => ({
        ...item,
        amountUsd: round2(Math.max(0, item.amountUsd)),
        cashbackUsd: round2(item.cashbackUsd),
        cashbackEur: round2(item.cashbackEur),
      }))
      .filter(item => item.amountUsd > 0)
      .sort((a, b) => b.amountUsd - a.amountUsd);

    const totals = categoryTotals.get(month.key);
    if (!totals || month.total <= 0) continue;
    month.categories = Array.from(totals.entries())
      .map(([key, { amount, count }]) => ({
        ...SPENDING_CATEGORIES[key],
        amount: round2(Math.max(0, amount)),
        count,
        percent: 0,
      }))
      .filter(category => category.amount > 0)
      .sort((a, b) => {
        if (a.key === 'other') return 1;
        if (b.key === 'other') return -1;
        return b.amount - a.amount;
      });
    const sum = month.categories.reduce((acc, category) => acc + category.amount, 0);
    month.categories.forEach(category => {
      category.percent = sum > 0 ? Math.round((category.amount / sum) * 100) : 0;
    });
  }

  return {
    months: monthKeys.map(key => months.get(key)!),
    currentMonthKey,
    firstPurchaseMonthKey:
      historyComplete && Number.isFinite(oldestPurchase) ? getMonthKey(oldestPurchase) : undefined,
    hasAnyPurchase,
  };
};

/**
 * Change against the previous month as a whole-number percent, or null when
 * there is nothing to compare against.
 */
export const getMonthOverMonthChange = (
  current: MonthSummary | undefined,
  previous: MonthSummary | undefined,
): number | null => {
  if (!current || !previous || previous.total <= 0) return null;
  return Math.round(((current.total - previous.total) / previous.total) * 100);
};

/** "$38.20", or "€38.20" for a euro figure. */
export const formatInsightAmount = (value: number, currency: CashbackCurrency): string =>
  `${CURRENCY_SYMBOLS[currency]}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatInsightUsd = (value: number): string => formatInsightAmount(value, 'USD');

/** Months worth showing: none from before the first purchase, when that is known. */
export const getVisibleMonths = (insights: SpendingInsights): MonthSummary[] => {
  const first = insights.firstPurchaseMonthKey;
  return first ? insights.months.filter(month => month.key >= first) : insights.months;
};

/** A month with what the screen says about it: the change, and whether it was the first. */
export const getMonthContext = (insights: SpendingInsights, key: string) => {
  const visible = getVisibleMonths(insights);
  const index = visible.findIndex(month => month.key === key);
  const month = index >= 0 ? visible[index] : undefined;
  const previous = index > 0 ? visible[index - 1] : undefined;
  return {
    month,
    previous,
    change: getMonthOverMonthChange(month, previous),
    isFirstMonth: insights.firstPurchaseMonthKey === key,
  };
};

/**
 * The newest month with any spend, or undefined when there is none.
 *
 * What the summary card and the Insights screen open on. The current month
 * alone would leave both empty for the first days of every month — on the 1st,
 * "Spent in October $0.00" hides the September the user actually wants to see.
 */
export const getLatestSpendMonthKey = (insights: SpendingInsights): string | undefined =>
  [...getVisibleMonths(insights)].reverse().find(month => month.total > 0)?.key;
