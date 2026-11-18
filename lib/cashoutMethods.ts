import type {
  TransfiCashoutConfig,
  TransfiCashoutCurrency,
  TransfiCashoutMethodSummary,
  TransfiCashoutMethodType,
  TransfiCashoutPaymentMethod,
} from '@/lib/types';

/** The cash-out list's filter chips: every country, or those paying out one way. */
export type CashoutFilter = 'all' | TransfiCashoutMethodType;

export const CASHOUT_METHOD_TYPE_LABEL: Record<TransfiCashoutMethodType, string> = {
  bank: 'Bank transfer',
  mobile_money: 'Mobile money',
};

/** How many method tags a row shows before folding the rest into "+N". */
export const VISIBLE_METHOD_TAGS = 2;

/** A bank method named only for being one ("NGN Bank Transfer"), not a rail like PIX. */
const GENERIC_BANK_NAME = /\bbank/i;

/**
 * Whether a method pays into a mobile wallet. Read from the server's `type`;
 * an older server only sends TransFi's `paymentType`, where wallets are
 * `local_wallet`.
 */
export const isMobileMoneyMethod = (
  method: Pick<TransfiCashoutPaymentMethod, 'type' | 'paymentType'>,
): boolean =>
  method.type ? method.type === 'mobile_money' : /wallet|mobile/i.test(method.paymentType ?? '');

/**
 * The tags on a country's row: each mobile wallet by name (PalmPay, M-Pesa),
 * since that's what people know them by; banks as one "Bank transfer", since
 * a list of fifty banks says less than that. A country paid through a single
 * named rail keeps its name (PIX, SPEI, SEPA Instant). Tags of the `first`
 * type lead, so a filtered list shows what it was filtered for.
 */
export const cashoutMethodTags = (
  methods: TransfiCashoutMethodSummary[] | undefined,
  first: TransfiCashoutMethodType = 'mobile_money',
): string[] => {
  if (!methods?.length) return [];
  const banks = methods.filter(method => method.type === 'bank');
  const wallets = methods.filter(method => method.type === 'mobile_money');

  const bankTags =
    banks.length === 1 && !GENERIC_BANK_NAME.test(banks[0].name)
      ? [banks[0].name]
      : banks.length
        ? [CASHOUT_METHOD_TYPE_LABEL.bank]
        : [];
  const walletTags = wallets.map(method => method.name);

  const ordered = first === 'bank' ? [...bankTags, ...walletTags] : [...walletTags, ...bankTags];
  const seen = new Set<string>();
  return ordered.filter(tag => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** What a row is called: the country, or the code when the server couldn't name one. */
export const cashoutCurrencyTitle = (option: TransfiCashoutCurrency): string =>
  option.country || option.currency;

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Whether a currency pays out the way the filter asks. Unknown methods only pass "all". */
export const matchesCashoutFilter = (option: TransfiCashoutCurrency, filter: CashoutFilter) =>
  filter === 'all' || Boolean(option.methods?.some(method => method.type === filter));

/**
 * Whether a search matches the country, the currency or a method — a bank's
 * own name included, so "GTBank" finds Nigeria. Every word has to match
 * something: "nigeria bank" narrows, it doesn't widen.
 */
export const matchesCashoutQuery = (option: TransfiCashoutCurrency, query: string) => {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    option.country ?? '',
    option.currency,
    ...(option.methods ?? []).flatMap(method => [
      method.name,
      CASHOUT_METHOD_TYPE_LABEL[method.type],
    ]),
  ]
    .map(fold)
    .join('\n');
  return terms.every(term => haystack.includes(term));
};

/**
 * The list as the screen shows it: the user's own currency apart, the rest by
 * name. A currency TransFi lists with no payout methods at all is left out —
 * a row that can only end in "no way to pay out" is a dead end.
 */
export const arrangeCashoutCurrencies = ({
  currencies,
  defaultCurrency,
  filter,
  query,
}: {
  currencies: TransfiCashoutCurrency[];
  defaultCurrency?: string;
  filter: CashoutFilter;
  query: string;
}): { yours?: TransfiCashoutCurrency; others: TransfiCashoutCurrency[] } => {
  const shown = currencies
    .filter(option => !option.methods || option.methods.length > 0)
    .filter(option => matchesCashoutFilter(option, filter))
    .filter(option => matchesCashoutQuery(option, query))
    .sort((a, b) => cashoutCurrencyTitle(a).localeCompare(cashoutCurrencyTitle(b)));
  const yours = shown.find(option => option.currency === defaultCurrency);
  return { yours, others: shown.filter(option => option !== yours) };
};

/** The one method a currency pays out through, when there's no choice to make. */
export const onlyCashoutMethod = (
  option: TransfiCashoutCurrency | undefined,
): TransfiCashoutMethodSummary | undefined =>
  option?.methods?.length === 1 ? option.methods[0] : undefined;

/** Whether the "how do you want to get paid" step is skipped for this currency. */
export const skipsCashoutMethodStep = (
  config: TransfiCashoutConfig | undefined,
  currency: string | undefined,
): boolean =>
  Boolean(onlyCashoutMethod(config?.currencies.find(option => option.currency === currency)));
