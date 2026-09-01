import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { TokenBalance } from '@/lib/types';

/** USD value of one holding: balance scaled out of its decimals × its USD rate. */
const tokenValueUSD = (token: TokenBalance): number => {
  const balance = Number(token.balance ?? 0) / 10 ** token.contractDecimals;
  const value = balance * (token.quoteRate ?? 0);
  // An unpriced token (quoteRate 0) contributes nothing rather than NaN-ing the
  // whole total, which is what a single missing rate used to do downstream.
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const matchesAsset = (token: TokenBalance, asset: CardSpendableAsset): boolean => {
  if (asset.chainIds && !asset.chainIds.includes(token.chainId)) return false;

  // Address wins outright where one is configured, and the ticker is not consulted at
  // all: the on-chain allowlist is keyed on the address, and the ticker is whatever the
  // balances indexer decided to call the token. Checking both would let an upstream
  // rename silently drop a spendable asset from the total.
  if (asset.addresses) {
    return asset.addresses.includes(token.contractAddress?.toLowerCase());
  }

  // No address: the asset is spendable wherever it is held, matched by ticker.
  return (
    asset.symbol !== undefined &&
    token.contractTickerSymbol?.toLowerCase() === asset.symbol.toLowerCase()
  );
};

/**
 * USD across the Safe's holdings that the card can spend.
 *
 * Filters the holdings by the configured assets rather than reading one named
 * balance, so the figure grows by editing `CARD_SPENDABLE_ASSETS` alone. Each
 * holding counts at most once however many entries match it, so an overlapping
 * config — say a bare "USDC" alongside a chain- or address-scoped one — cannot
 * double count the same money.
 */
export const sumCardSpendableUSD = (
  tokens: TokenBalance[] | undefined,
  assets: CardSpendableAsset[],
): number =>
  (tokens ?? [])
    .filter(token => assets.some(asset => matchesAsset(token, asset)))
    .reduce((total, token) => total + tokenValueUSD(token), 0);
