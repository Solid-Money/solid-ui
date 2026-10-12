import { BRIDGE_TOKENS, EURC_TOKENS, getBridgeTokenDecimals } from '@/constants/bridge';
import { CardFundRoute } from '@/lib/utils/cardFundMove';
import { getAllowedTokensForChain, getVaultDepositConfig } from '@/lib/vaults';

/**
 * What "Fund your card" offers each issuer, and which routes it accepts.
 *
 * A leaf module rather than part of `components/Card/CardFund/constants`, for the
 * same reason as `cardStatusRouting`: that file reaches `lib/assets` for the row
 * icons, whose import graph does not load under jest-expo. Everything the funding
 * flow has to be *correct* about — which methods an issuer gets, which token on
 * which chain, and the copy derived from both — lives here where it can be
 * tested, and none of it needs an icon to be right. `constants` re-exports every
 * name so components keep one import path.
 */

/** Stablecoins the direct-deposit flow offers, in display order. */
export const CARD_FUND_TOKEN_SYMBOLS = ['USDC', 'USDT'] as const;

/**
 * EURC, offered after the dollar stablecoins to Wirex cardholders only.
 *
 * Not one of `CARD_FUND_TOKEN_SYMBOLS`. Those are delivered to wherever the
 * issuer spends from; EURC is delivered as EURC to the Safe on Base, where the
 * Base spend-module instance sells it, whoever issued the card - and is offered
 * only on the chains `EURC_TOKENS` lists (Base, for now).
 */
export const CARD_FUND_EURC_SYMBOL = 'EURC';

/** One chain a card deposit can arrive from. */
export interface CardFundChain {
  chainId: number;
  name: string;
  isComingSoon?: boolean;
}

/**
 * Chains that can receive a direct deposit of `symbol`, in display order.
 *
 * The single source both the network picker and the route table read, so the
 * chips a user is shown and the transfers the move flow will offer cannot
 * disagree about which chains are live.
 */
export const getCardFundChains = (symbol: string): CardFundChain[] => {
  const depositConfig = getVaultDepositConfig();
  // EURC is kept out of BRIDGE_TOKENS (see EURC_TOKENS), so it has its own table.
  const carries = (chainId: number) =>
    symbol === CARD_FUND_EURC_SYMBOL
      ? !!EURC_TOKENS[chainId]
      : getAllowedTokensForChain(chainId).includes(symbol);

  return Object.entries(BRIDGE_TOKENS)
    .map(([id, chain]) => ({ chainId: Number(id), chain }))
    .filter(({ chainId }) => depositConfig.supportedChains.includes(chainId))
    .filter(({ chainId }) => carries(chainId))
    .sort((a, b) => a.chain.sort - b.chain.sort)
    .map(({ chainId, chain }) => ({
      chainId,
      name: chain.name,
      isComingSoon: chain.isComingSoon,
    }));
};

/**
 * Every (network, stablecoin, contract) the pipeline accepts in dollars, which
 * is exactly what the dollar token rows offer.
 *
 * EURC is not a route to move along. On Base it already sits in the Safe the
 * euro balance is spent from, so a move would only send it out and back.
 *
 * The contract comes from `BRIDGE_TOKENS`, the same table the backend resolves a
 * detected transfer against, so a holding matched here is one it will whitelist
 * rather than refund. A chain still marked "coming soon" is left out: the row is
 * shown greyed for a reason, and a move to it would sit undetected.
 */
export const getCardFundRoutes = (): CardFundRoute[] =>
  CARD_FUND_TOKEN_SYMBOLS.flatMap(symbol =>
    getCardFundChains(symbol)
      .filter(chain => !chain.isComingSoon)
      .flatMap(chain => {
        const address = BRIDGE_TOKENS[chain.chainId]?.tokens?.[symbol]?.address;
        if (!address) return [];

        return [
          {
            chainId: chain.chainId,
            symbol,
            address,
            decimals: getBridgeTokenDecimals(chain.chainId, symbol),
          },
        ];
      }),
  );

/**
 * Every network any of `symbols` can be sent from, in display order.
 *
 * The per-token rows already carry their own chips; this is the union, for copy
 * that has to describe the whole flow rather than one row of it.
 */
export const getCardFundSupportedNetworkNames = (
  symbols: readonly string[] = CARD_FUND_TOKEN_SYMBOLS,
): string[] => {
  const seen = new Map<number, string>();

  for (const symbol of symbols) {
    for (const chain of getCardFundChains(symbol)) {
      if (!chain.isComingSoon) seen.set(chain.chainId, chain.name);
    }
  }

  return [...seen.values()];
};

/**
 * The two constraints a card deposit fails on, in the words the failure teaches.
 *
 * Both halves are lessons from real tickets. "Only these tokens on these networks"
 * is the refund path — anything else is sent back or diverted to the Safe. "Only
 * the address shown here" is the worse one: a deposit to the user's own wallet
 * address arrives safely, shows up in Wallet, and then cannot be spent, which
 * reads as money lost rather than a mistake with a fix.
 *
 * Interpolated from the same tables the flow routes on, so a network added or
 * withdrawn cannot leave this sentence claiming otherwise. EURC, when offered,
 * gets its own clause: it is accepted on far fewer networks than the dollars.
 */
export const getCardFundRoutesTooltip = (
  symbols: readonly string[] = CARD_FUND_TOKEN_SYMBOLS,
): string => {
  const dollars = symbols.filter(symbol => symbol !== CARD_FUND_EURC_SYMBOL);
  const routes = [
    `${dollars.join(' or ')} only, on ${joinWithOr(getCardFundSupportedNetworkNames(dollars))}`,
  ];
  if (symbols.includes(CARD_FUND_EURC_SYMBOL)) {
    routes.push(
      `${CARD_FUND_EURC_SYMBOL} only on ${joinWithOr(getCardFundSupportedNetworkNames([CARD_FUND_EURC_SYMBOL]))}`,
    );
  }

  return (
    `${routes.join('; ')}. ` +
    'Send to the address this flow shows — a deposit to your own wallet address lands in Wallet, not on your card.'
  );
};

/** "A", "A or B", "A, B or C". */
const joinWithOr = (names: string[]): string =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];

/**
 * The direct-deposit destination that selects the *card* deposit address.
 *
 * Named for Rain because Rain was the only issuer when the address was first
 * derived, and its salt — and so every address already handed out — has to stay
 * exactly as it was. A Wirex cardholder deposits to the same address; the
 * backend resolves the issuer and delivers the funds to the Rain card on Base
 * or to the cardholder's Safe on Fuse accordingly. EURC is the exception: it
 * goes to the Safe on Base, as EURC, whichever the issuer.
 */
export const CARD_FUND_DESTINATION_TYPE = 'RAIN_CARD' as const;

/**
 * Which groups the "Fund your card" step shows.
 *
 * Configuration rather than a prop per row, because what differs between the two
 * issuers is only *which* methods are wired up, not how the screen works. A
 * method is switched on here as its backend leg lands, so enabling one is a
 * one-line change instead of a second copy of the options screen.
 */
export type CardFundSections = {
  stablecoins: boolean;
  /**
   * USD — the virtual account's ACH / Wire, Apple Pay, and Cash App where it is
   * offered. All of them are listed under USD, so off means none is offered.
   */
  cashDeposit: boolean;
  /** BRL, BDT, MXN, PHP — the buy-crypto onramp. */
  localCurrencies: boolean;
  /** "Move from wallet or savings". */
  moveFromSolid: boolean;
  /** "Deposit from an external wallet". */
  externalWallet: boolean;
};

/** Rain cards offer every funding method. */
export const RAIN_CARD_FUND_SECTIONS: CardFundSections = {
  stablecoins: true,
  cashDeposit: true,
  localCurrencies: true,
  moveFromSolid: true,
  externalWallet: true,
};

/**
 * Wirex cards offer direct stablecoin deposits, the local-currency onramp, and
 * moving what the cardholder already holds in Solid.
 *
 * Local currencies work because the onramp needs no Fuse leg of its own: TransFi
 * has no USDC-on-Fuse entry, so the backend points the delivery at the same card
 * deposit address the stablecoin rows hand out, and the direct-deposit pipeline
 * carries it to the Safe on Fuse from there.
 *
 * `moveFromSolid` is on for the same reason, and takes the same route: the app
 * transfers from the cardholder's Safe to that card deposit address and the
 * pipeline does the rest. That is deliberately *not* the Rain mechanic (approve,
 * then a backend pull via `POST /deposit`), which delivers to Base and would need
 * a Fuse-pointed leg of its own. See `WirexMoveFromWallet`.
 *
 * `cashDeposit` and `externalWallet` still need their own backend legs pointed at
 * Fuse, so they stay off rather than being offered and then failing with no
 * destination.
 */
export const WIREX_CARD_FUND_SECTIONS: CardFundSections = {
  stablecoins: true,
  cashDeposit: false,
  localCurrencies: true,
  moveFromSolid: true,
  externalWallet: false,
};

/**
 * The "move from Solid" row, per issuer.
 *
 * Wirex says "wallet" and not "wallet or savings", and the omission is the point:
 * a Wirex card settles from soUSD on Fuse directly, so savings is *already*
 * spendable and has nothing to move. Offering to move it would be offering a
 * bridge round trip that ends where it started.
 */
export const CARD_FUND_MOVE_COPY: Record<'rain' | 'wirex', { title: string; subtitle: string }> = {
  rain: {
    title: 'Move from wallet or savings',
    subtitle: 'Use funds you already hold in Solid',
  },
  wirex: {
    title: 'Move from wallet',
    subtitle: 'Make funds on other networks spendable',
  },
};
