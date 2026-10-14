import { ActivityEvent, SwapTokenResponse, TransactionType } from '@/lib/types';

/**
 * Keeping airdropped spam tokens out of the activity feed.
 *
 * Scammers drop worthless ERC-20s (ZORRA, PEPE, MIRROR, GENESIS, ...) on every
 * Safe they can find, mostly on Base. The wallet's balance list already hides
 * them: it only shows tokens on the curated `swap-tokens` list (see
 * `useBalances`). The activity feed never applied that list, so each airdrop
 * still turned up as a "Receive ZORRA" row.
 *
 * The backend now drops these on sync and sweeps the stored ones, but the
 * activity store only ever merges rows in — one the server stopped listing
 * stays on the device. So the feed applies the same list here too.
 *
 * Matched on chain and contract address, never on symbol: anyone can name a
 * token USDC. Only incoming token transfers are judged; a row without a token
 * address, native currency, and anything the user sent are left alone.
 */

/** Placeholder addresses native currency (ETH, FUSE, BNB, POL) is reported with. */
export const NATIVE_TOKEN_ADDRESSES: ReadonlySet<string> = new Set([
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

export type ListedTokens = ReadonlySet<string>;

const listedTokenKey = (chainId: number, address: string): string =>
  `${chainId}:${address.toLowerCase()}`;

/**
 * The listed tokens as a lookup set, or null when there is no list to go by.
 * Null means "show everything", as the balance list does when the request
 * fails: hiding every receive because a request failed would be worse.
 */
export const toListedTokens = (list: SwapTokenResponse[] | undefined): ListedTokens | null => {
  const keys = new Set<string>();
  for (const token of list ?? []) {
    if (token.address && typeof token.chainId === 'number') {
      keys.add(listedTokenKey(token.chainId, token.address));
    }
  }
  return keys.size > 0 ? keys : null;
};

/** Whether this activity is a token landing that the list does not name. */
export const isUnlistedTokenReceive = (
  activity: ActivityEvent,
  listed: ListedTokens | null,
): boolean => {
  if (!listed) return false;
  if (activity.type !== TransactionType.RECEIVE) return false;
  if (typeof activity.chainId !== 'number') return false;

  const tokenAddress: unknown = activity.metadata?.tokenAddress;
  if (typeof tokenAddress !== 'string' || !tokenAddress) return false;
  if (NATIVE_TOKEN_ADDRESSES.has(tokenAddress.toLowerCase())) return false;

  return !listed.has(listedTokenKey(activity.chainId, tokenAddress));
};
