import { CardSpendableAsset } from '@/constants/cardSpendableAssets';
import { TokenBalance } from '@/lib/types';
import { isCardSpendable } from '@/lib/utils/cardSpendable';

/**
 * One (network, stablecoin) pair the card's direct-deposit pipeline accepts,
 * with the exact contract the backend whitelists for it.
 *
 * Passed in rather than derived here. The route table lives beside the funding
 * screens (`getCardFundNetworks`) and pulls in the vault deposit config; this
 * module stays a leaf so it is unit testable, in the same spirit as
 * `cardStatusRouting`.
 */
export interface CardFundRoute {
  chainId: number;
  symbol: string;
  /** The whitelisted contract on `chainId`, as `BRIDGE_TOKENS` gives it. */
  address: string;
  /**
   * Decimals the bridge table declares for that contract — 18 for BNB Chain's
   * Binance-Peg USDC/USDT, 6 everywhere else.
   */
  decimals: number;
}

/** A wallet holding the card cannot spend, but the deposit pipeline can carry. */
export interface MovableHolding {
  chainId: number;
  symbol: string;
  tokenAddress: string;
  decimals: number;
  /** Raw balance in token units — what an ERC-20 transfer takes. */
  balance: string;
  /** `balance` scaled out of its decimals. */
  amount: number;
  /** `amount` at its quoted rate; 0 when the holding could not be priced. */
  valueUSD: number;
}

/** `balance` scaled out of `contractDecimals`, or 0 for anything unparseable. */
const toAmount = (token: TokenBalance): number => {
  const amount = Number(token.balance ?? 0) / 10 ** token.contractDecimals;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

/**
 * What a Wirex cardholder can move from Wallet to their card, richest first.
 *
 * A holding qualifies on three counts, and each one exists because dropping it
 * would strand money rather than move it:
 *
 * 1. **It is on a route the pipeline accepts.** Matched on the contract address,
 *    never the ticker. The backend whitelists one contract per stablecoin per
 *    chain and refunds everything else, and Fuse alone carries several contracts
 *    calling themselves USDC — so a ticker match would offer a move that comes
 *    straight back as a refund, minus the gas.
 * 2. **The card cannot already spend it.** Bridged USDC/USDT and soUSD on Fuse are
 *    what settlement draws from, so "moving" them is a round trip to the same
 *    balance. They are the largest holding for most cardholders, so an unfiltered
 *    list would put the one useless option at the top.
 * 3. **It has a balance.** A zero row is an invitation to a transaction that
 *    reverts.
 *
 * And one cross-check: the balances indexer and the bridge table have to agree on
 * the contract's decimals. They are two readings of one number and both are used
 * — the indexer's to show the balance, the table's to size the transfer — so a
 * disagreement means one of them would send the wrong amount by a factor of
 * 10^12 on BNB Chain. Excluding the holding is the safe half of that: the user
 * sees one fewer option rather than a move that misfires.
 *
 * Ordered by USD value, falling back to token amount so an unpriced holding still
 * sorts sensibly among its peers instead of sinking below dust.
 */
export const getMovableHoldings = (
  tokens: TokenBalance[] | undefined,
  routes: CardFundRoute[],
  spendableAssets: CardSpendableAsset[],
): MovableHolding[] => {
  const byAddress = new Map<string, CardFundRoute>(
    routes.map(route => [`${route.chainId}:${route.address.toLowerCase()}`, route]),
  );

  return (tokens ?? [])
    .flatMap(token => {
      const route = byAddress.get(`${token.chainId}:${token.contractAddress?.toLowerCase()}`);
      if (!route) return [];
      if (isCardSpendable(token, spendableAssets)) return [];
      if (token.contractDecimals !== route.decimals) return [];

      const amount = toAmount(token);
      if (amount <= 0) return [];

      const value = amount * (token.quoteRate ?? 0);

      return [
        {
          chainId: route.chainId,
          symbol: route.symbol,
          tokenAddress: route.address,
          decimals: route.decimals,
          balance: token.balance,
          amount,
          valueUSD: Number.isFinite(value) && value > 0 ? value : 0,
        },
      ];
    })
    .sort((a, b) => b.valueUSD - a.valueUSD || b.amount - a.amount);
};

/**
 * Below this a holding is dust: a swap would cost more in fees than it delivers,
 * and listing it only pads the screen.
 */
export const MIN_SWAPPABLE_VALUE_USD = 1;

/** soUSD, soETH, soFUSE: Solid vault shares, by the ticker convention every vault follows. */
const isSolidVaultShare = (symbol: string | undefined): boolean => /^so[A-Z]/.test(symbol ?? '');

/** A wallet holding the card cannot take as is, but an in-app swap can turn into one it can. */
export interface SwappableHolding {
  chainId: number;
  symbol: string;
  /** The token's contract, or the zero address for the chain's native currency. */
  tokenAddress: string;
  /** `balance` scaled out of its decimals. */
  amount: number;
  /** `amount` at its quoted rate; at least {@link MIN_SWAPPABLE_VALUE_USD}. */
  valueUSD: number;
  logoUrl?: string;
}

/**
 * What a Wirex cardholder holds that neither the card nor "Move from wallet" can
 * use — ETH on Ethereum, POL, FUSE and the like — richest first.
 *
 * Exists because the alternative was telling the user their wallet holds nothing
 * else. A cardholder who had just sent ~$390 of ETH on Ethereum to their Safe
 * opened "Move from wallet", read that there was nothing to move, and concluded
 * the money was stuck: the card takes stablecoins only, and the deposit pipeline
 * refunds anything else. The in-app swap does reach it, though, cross-chain
 * included, so the honest answer is "swap it first", with the way to do that.
 *
 * Qualifies when it is:
 *
 * 1. **On a chain the swap form quotes through LI.FI.** That is every swap chain
 *    but Fuse, and passed in rather than imported to keep this module a leaf.
 *    Fuse is left out on purpose: a Fuse-to-Fuse swap goes through Algebra, which
 *    has no pool for most of the Fuse catalogue (legacy USDC, deprecated USDT),
 *    so the row would open a form that cannot quote.
 * 2. **Neither spendable nor movable.** Those two already have a better path, and
 *    listing them here as well would offer a swap where a free move exists.
 * 3. **Not a Solid savings share** (soUSD, soETH…). Those are the user's savings;
 *    getting them to the card is a savings withdrawal, not a market sale.
 * 4. **Priced, and worth at least {@link MIN_SWAPPABLE_VALUE_USD}.** The price is
 *    also the guard against an unlisted token: the balances list falls back to
 *    every token the indexer reports when the catalogue fails to load, and a
 *    spam airdrop is the one thing that is never priced.
 */
export const getSwappableHoldings = (
  tokens: TokenBalance[] | undefined,
  routes: CardFundRoute[],
  spendableAssets: CardSpendableAsset[],
  lifiChainIds: readonly number[],
): SwappableHolding[] => {
  const routed = new Set(routes.map(route => `${route.chainId}:${route.address.toLowerCase()}`));

  return (tokens ?? [])
    .flatMap(token => {
      if (!lifiChainIds.includes(token.chainId)) return [];
      if (!token.contractAddress) return [];
      if (isSolidVaultShare(token.contractTickerSymbol)) return [];
      if (routed.has(`${token.chainId}:${token.contractAddress.toLowerCase()}`)) return [];
      if (isCardSpendable(token, spendableAssets)) return [];

      const amount = toAmount(token);
      const value = amount * (token.quoteRate ?? 0);
      if (!Number.isFinite(value) || value < MIN_SWAPPABLE_VALUE_USD) return [];

      return [
        {
          chainId: token.chainId,
          symbol: token.contractTickerSymbol,
          tokenAddress: token.contractAddress,
          amount,
          valueUSD: value,
          logoUrl: token.logoUrl,
        },
      ];
    })
    .sort((a, b) => b.valueUSD - a.valueUSD);
};
