import { InfiniteData } from '@tanstack/react-query';

import { CardTransaction } from '@/lib/types';
import { getCardTransactionTimestamp } from '@/lib/utils/unifiedActivity';

import type { CardTransactionsPage } from '@/hooks/useCardTransactions';

export type CardTransactionsCache = InfiniteData<CardTransactionsPage, string | undefined>;

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/** Field by field; nested values (fees, details) by content. */
export const isSameCardTransaction = (a: CardTransaction, b: CardTransaction): boolean => {
  if (a === b) return true;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const x = left[key];
    const y = right[key];
    if (x === y) continue;
    if (isObject(x) && isObject(y) && JSON.stringify(x) === JSON.stringify(y)) continue;
    return false;
  }
  return true;
};

/**
 * A pushed transaction laid over the cached one.
 *
 * Only the fields the push carries: the pushed shape is the list endpoint's,
 * minus what that endpoint decorates rows with afterwards (fees) and what only
 * the single read returns (our ledger's spend details). Overwriting with the
 * push wholesale would drop those from a row that already had them.
 */
export const mergeCardTransaction = (
  existing: CardTransaction,
  incoming: CardTransaction,
): CardTransaction => {
  const merged = { ...existing } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged as unknown as CardTransaction;
};

/** Newest first, by the same date the activity feed sorts card rows on. */
const insertByTime = (rows: CardTransaction[], transaction: CardTransaction) => {
  const time = getCardTransactionTimestamp(transaction);
  const index = rows.findIndex(row => getCardTransactionTimestamp(row) < time);
  return index === -1
    ? [...rows, transaction]
    : [...rows.slice(0, index), transaction, ...rows.slice(index)];
};

/**
 * Whether a transaction not in the cache belongs on its first page: the whole
 * history is loaded, or it is newer than the oldest row the page holds. An
 * older one is history the user has not scrolled to, and placing it on the
 * first page would show it out of order.
 */
const belongsOnFirstPage = (cache: CardTransactionsCache, transaction: CardTransaction) => {
  const first = cache.pages[0];
  if (!first) return false;
  const wholeHistoryLoaded = cache.pages.length === 1 && !first.nextPage;
  if (wholeHistoryLoaded || first.data.length === 0) return true;
  const oldest = Math.min(...first.data.map(getCardTransactionTimestamp));
  return getCardTransactionTimestamp(transaction) >= oldest;
};

/**
 * Lay pushed or freshly fetched transactions over the cached card history.
 *
 * Returns the cache itself — the same reference — when nothing it would
 * render changed, which is what keeps a repeated event from re-rendering the
 * activity feed: the caller skips the write entirely. A cache that has not
 * loaded is left alone; its first fetch will bring the row.
 */
export const upsertCardTransactions = (
  cache: CardTransactionsCache | undefined,
  incoming: CardTransaction[],
): CardTransactionsCache | undefined => {
  if (!cache?.pages?.length || incoming.length === 0) return cache;

  let pages = cache.pages;
  for (const transaction of incoming) {
    if (!transaction?.id) continue;

    let found = false;
    let pagesChanged = false;
    const nextPages = pages.map(page => {
      let pageChanged = false;
      const data = page.data.map(row => {
        if (row.id !== transaction.id) return row;
        found = true;
        const merged = mergeCardTransaction(row, transaction);
        if (isSameCardTransaction(row, merged)) return row;
        pageChanged = true;
        return merged;
      });
      if (!pageChanged) return page;
      pagesChanged = true;
      return { ...page, data };
    });
    if (pagesChanged) pages = nextPages;

    if (!found && belongsOnFirstPage({ ...cache, pages }, transaction)) {
      const [first, ...rest] = pages;
      pages = [{ ...first, data: insertByTime(first.data, transaction) }, ...rest];
    }
  }

  return pages === cache.pages ? cache : { ...cache, pages };
};

/** The transaction with this id, wherever it sits in the cached history. */
export const findCardTransaction = (
  cache: CardTransactionsCache | undefined,
  transactionId: string,
): CardTransaction | undefined => {
  for (const page of cache?.pages ?? []) {
    const match = page.data.find(row => row.id === transactionId);
    if (match) return match;
  }
  return undefined;
};
