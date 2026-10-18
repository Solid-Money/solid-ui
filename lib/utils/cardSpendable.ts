import {
  baseEurcSpendableAsset,
  CARD_SPENDABLE_ASSETS,
  CardSpendableAsset,
} from '@/constants/cardSpendableAssets';
import { BASE_SPEND_DEPLOYMENT } from '@/constants/spendModuleDeployments';
import { CardSpendDeployment, TokenBalance } from '@/lib/types';

/** USD value of one holding: balance scaled out of its decimals × its USD rate. */
const tokenValueUSD = (token: TokenBalance): number => {
  const balance = Number(token.balance ?? 0) / 10 ** token.contractDecimals;
  const value = balance * (token.quoteRate ?? 0);
  // An unpriced token (quoteRate 0) contributes nothing rather than NaN-ing the
  // whole total, which is what a single missing rate used to do downstream.
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export const matchesAsset = (token: TokenBalance, asset: CardSpendableAsset): boolean => {
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
    .filter(token => isCardSpendable(token, assets))
    .reduce((total, token) => total + tokenValueUSD(token), 0);

/**
 * Whether this exact holding is one the card can already settle from.
 *
 * The same predicate the total is built on, named so the move-to-card flow can ask
 * the inverse question. Both have to agree: offering to move something the
 * "Spendable" row is already counting would take the user's money on a bridge
 * round trip to arrive at the balance it started in.
 */
export const isCardSpendable = (token: TokenBalance, assets: CardSpendableAsset[]): boolean =>
  assets.some(asset => matchesAsset(token, asset));

/**
 * The assets this cardholder's card can spend, given which instances they have enabled.
 *
 * The Fuse set always, plus EURC on Base once the backend records the user enabling the Base
 * instance and still routes to it (`available`). The backend's record rather than a chain read,
 * for the reason `useEuroSpendEnablement` gives: a slow Base RPC must not make the figure jump.
 * The chain is still what decides a purchase.
 *
 * The EURC address is the instance's own allowlist as the backend serves it. An empty list is an
 * answer, not a gap: that backend's Base instance spends nothing (QA ships with no EURC address),
 * and filling it from this build would count EURC the card cannot spend. The build's address is
 * only a fallback for a response with no `spendTokens` at all.
 */
export const cardSpendableAssetsFor = (
  deployments: CardSpendDeployment[] | undefined,
): CardSpendableAsset[] => {
  const baseDeployment = deployments?.find(
    deployment => deployment.chainId === BASE_SPEND_DEPLOYMENT.chainId,
  );
  if (!baseDeployment?.enabled || !baseDeployment.available) return CARD_SPENDABLE_ASSETS;

  const addresses =
    baseDeployment.spendTokens ??
    (BASE_SPEND_DEPLOYMENT.spendTokenAddress ? [BASE_SPEND_DEPLOYMENT.spendTokenAddress] : []);
  if (!addresses.length) return CARD_SPENDABLE_ASSETS;

  return [...CARD_SPENDABLE_ASSETS, baseEurcSpendableAsset(addresses)];
};

/**
 * EURC held on Base, in euros — the balance euro spending lets the card draw on.
 *
 * Matched on this build's EURC address when it has one. Without it, on the Base instance's
 * allowlist — but only the EURC on it: that list is a draw order, and holds dollar assets too
 * once USDC debits move to Base, which counted here would be dollars quoted as euros. Failing
 * both, on the ticker: the question is "does this cardholder hold EURC the card cannot reach",
 * and an unconfigured QA address must not answer "no" for everyone.
 */
export const baseEurcHeld = (
  tokens: TokenBalance[] | undefined,
  deployments: CardSpendDeployment[] | undefined,
): number => {
  const configured = BASE_SPEND_DEPLOYMENT.spendTokenAddress?.toLowerCase();
  const allowlist = (
    deployments?.find(deployment => deployment.chainId === BASE_SPEND_DEPLOYMENT.chainId)
      ?.spendTokens ?? []
  ).map(address => address.toLowerCase());

  const isBaseEurc = (token: TokenBalance): boolean => {
    if (token.chainId !== BASE_SPEND_DEPLOYMENT.chainId) return false;
    const address = token.contractAddress?.toLowerCase() ?? '';
    if (configured) return address === configured;
    const ticker = token.contractTickerSymbol?.trim().toUpperCase() === 'EURC';
    return allowlist.length ? ticker && allowlist.includes(address) : ticker;
  };

  return (tokens ?? []).filter(isBaseEurc).reduce((total, token) => {
    const amount = Number(token.balance ?? 0) / 10 ** token.contractDecimals;
    return Number.isFinite(amount) && amount > 0 ? total + amount : total;
  }, 0);
};
