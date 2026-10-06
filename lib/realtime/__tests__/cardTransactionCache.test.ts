import {
  CardTransactionsCache,
  findCardTransaction,
  mergeCardTransaction,
  upsertCardTransactions,
} from '@/lib/realtime/cardTransactionCache';
import { CardTransaction, CardTransactionCategory } from '@/lib/types';

const tx = (id: string, authorizedAt: string, extra: Partial<CardTransaction> = {}) =>
  ({
    id,
    card_account_id: 'card-1',
    customer_id: 'cus-1',
    category: CardTransactionCategory.PURCHASE,
    amount: '10.00',
    currency: 'usd',
    status: 'approved',
    description: '',
    posted_at: '',
    authorized_at: authorizedAt,
    related_transaction_ids: [],
    merchant_name: `Merchant ${id}`,
    ...extra,
  }) as CardTransaction;

const cacheOf = (...pages: { data: CardTransaction[]; nextPage?: string }[]) =>
  ({
    pages: pages.map(page => ({
      data: page.data,
      nextPage: page.nextPage,
      hasNextPage: !!page.nextPage,
    })),
    pageParams: pages.map((_, index) => (index === 0 ? undefined : String(index))),
  }) as CardTransactionsCache;

const newer = tx('new', '2026-09-03T10:00:00.000Z');
const middle = tx('mid', '2026-09-02T10:00:00.000Z');
const older = tx('old', '2026-09-01T10:00:00.000Z');

describe('upsertCardTransactions', () => {
  it('leaves a cache that never loaded for its own first fetch', () => {
    expect(upsertCardTransactions(undefined, [newer])).toBeUndefined();
  });

  it('returns the same cache when the push changes nothing, so nothing re-renders', () => {
    const cache = cacheOf({ data: [middle, older] });

    expect(upsertCardTransactions(cache, [{ ...middle }])).toBe(cache);
    expect(upsertCardTransactions(cache, [])).toBe(cache);
  });

  it('updates the row in place, touching only the page it is on', () => {
    const second = { data: [older] };
    const cache = cacheOf({ data: [middle], nextPage: '1' }, second);

    const next = upsertCardTransactions(cache, [{ ...older, status: 'settled' }])!;

    expect(next).not.toBe(cache);
    expect(next.pages[0]).toBe(cache.pages[0]);
    expect(findCardTransaction(next, 'old')?.status).toBe('settled');
  });

  it('keeps the fees and ledger details the push does not carry', () => {
    const fees = [
      {
        category: 'fx',
        label: 'FX fee',
        amount: '0.10',
        currency: 'USD',
        percentage: 0.01,
        status: 'Charged',
        tier: 'core',
      },
    ];
    const cache = cacheOf({ data: [{ ...middle, fees }] });

    const next = upsertCardTransactions(cache, [{ ...middle, status: 'settled' }])!;

    const row = findCardTransaction(next, 'mid');
    expect(row?.status).toBe('settled');
    expect(row?.fees).toEqual(fees);
  });

  it('puts a new purchase on the first page in date order', () => {
    const cache = cacheOf({ data: [middle, older] });

    const next = upsertCardTransactions(cache, [newer])!;

    expect(next.pages[0].data.map(row => row.id)).toEqual(['new', 'mid', 'old']);
  });

  it('files a late-reported transaction by its own date, not at the top', () => {
    const cache = cacheOf({ data: [newer, older] });

    const next = upsertCardTransactions(cache, [middle])!;

    expect(next.pages[0].data.map(row => row.id)).toEqual(['new', 'mid', 'old']);
  });

  it('adds the very first transaction to an empty history', () => {
    const next = upsertCardTransactions(cacheOf({ data: [] }), [newer])!;

    expect(next.pages[0].data).toEqual([newer]);
  });

  it('does not pull older history onto the first page when later pages are unloaded', () => {
    const cache = cacheOf({ data: [newer, middle], nextPage: '1' });
    const ancient = tx('ancient', '2026-01-01T10:00:00.000Z');

    expect(upsertCardTransactions(cache, [ancient])).toBe(cache);
  });

  it('applies a batch in one pass', () => {
    const cache = cacheOf({ data: [older] });

    const next = upsertCardTransactions(cache, [newer, { ...older, status: 'declined' }, middle])!;

    expect(next.pages[0].data.map(row => [row.id, row.status])).toEqual([
      ['new', 'approved'],
      ['mid', 'approved'],
      ['old', 'declined'],
    ]);
  });

  it('ignores a push with no id', () => {
    const cache = cacheOf({ data: [older] });

    expect(upsertCardTransactions(cache, [{ ...newer, id: '' }])).toBe(cache);
  });
});

describe('mergeCardTransaction', () => {
  it('does not let an absent field erase one the cache has', () => {
    const merged = mergeCardTransaction({ ...middle, usd_amount: '9.00' }, {
      ...middle,
      usd_amount: undefined,
      status: 'settled',
    } as CardTransaction);

    expect(merged.usd_amount).toBe('9.00');
    expect(merged.status).toBe('settled');
  });
});
