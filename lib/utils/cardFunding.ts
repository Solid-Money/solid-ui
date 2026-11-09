import { base } from 'viem/chains';

import { BRIDGE_TOKENS, EURC_TOKENS, getBridgeTokenDecimals } from '@/constants/bridge';
import {
  findRhinoRoute,
  getRhinoExtraChains,
  isOwnPipelineToken,
  resolveRhinoRow,
  RhinoAssetsState,
  RhinoDepositSelection,
} from '@/lib/rhinoDeposit';
import { CardProvider } from '@/lib/types';
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

/**
 * Crypto the card takes, after the stablecoins: native BTC, sent on Bitcoin
 * and sold for USDC on the way, through rhino.fi's card route. Not a
 * `CARD_FUND_TOKEN_SYMBOLS` entry: no chain the list has a row for carries it,
 * so it is offered under "More networks" alone, and nothing moves it.
 */
export const CARD_FUND_CRYPTO_SYMBOLS = ['BTC'] as const;

/** A crypto row on "Fund your card", with the networks it can be sent on. */
export interface CardFundCryptoRow {
  symbol: string;
  networks: string[];
}

/**
 * The crypto rows "Fund your card" lists: each that rhino.fi takes to the card
 * from somewhere (BTC from Bitcoin, where the backend has Bitcoin switched
 * on), named with those networks. Like the wallet's, only for those given the
 * new deposit tokens (see `useDepositTokensAccess`), and none until rhino.fi's
 * routes are in, since only they say a row has anywhere to be sent from.
 */
export const getCardFundCryptoRows = (
  rhino: RhinoAssetsState,
  hasNewTokens: boolean,
): CardFundCryptoRow[] => {
  if (rhino.status !== 'ready' || !hasNewTokens) return [];
  return CARD_FUND_CRYPTO_SYMBOLS.flatMap(symbol => {
    const chains = getRhinoExtraChains(rhino.assets, {
      destinationType: CARD_FUND_DESTINATION_TYPE,
      symbol,
    });
    return chains.length ? [{ symbol, networks: chains.map(chain => chain.name) }] : [];
  });
};

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
 * backend resolves the issuer and delivers the funds to the Rain card on Base,
 * or for Wirex to the cardholder's Safe: on Fuse for a deposit made on Fuse, on
 * Base for one made anywhere else. EURC is the exception: it goes to the Safe on
 * Base, as EURC, whichever the issuer.
 */
export const CARD_FUND_DESTINATION_TYPE = 'RAIN_CARD' as const;

/**
 * The rhino.fi route a card deposit row is matched against.
 *
 * - Rain's dollar stablecoins: the card's own (`RAIN_CARD`). rhino.fi pays the
 *   card deposit address on Base, and the pipeline takes it on to the card, as
 *   for a direct transfer.
 * - Rain's BTC, sent on Bitcoin: `RAIN_CARD` too, which sells it for USDC.
 * - A Wirex cardholder's: `WALLET`, which pays their Safe on Base, where their
 *   card deposits off Fuse now land. Routing them through the card address
 *   would only reach the same Safe a leg later.
 * - EURC, whoever issued the card: `WALLET`. No card route takes it (they are
 *   dollar routes), and the card address only ever delivered it as EURC to the
 *   Safe on Base — exactly where rhino.fi's `WALLET` route pays.
 *
 * USDT takes these too, and arrives as USDC: rhino.fi cannot pay USDT out on
 * Base for us, so both routes swap it. Sent on Base itself it takes neither:
 * our own pipeline keeps it there (see `OWN_PIPELINE_TOKEN_CHAINS`), so that
 * row mints the card's own `RAIN_CARD` session whatever is returned here.
 */
export const getCardFundRhinoDestination = (
  symbol: string,
  provider: CardProvider | null | undefined,
): 'RAIN_CARD' | 'WALLET' =>
  symbol === CARD_FUND_EURC_SYMBOL || provider === CardProvider.WIREX
    ? 'WALLET'
    : CARD_FUND_DESTINATION_TYPE;

/**
 * Where "Move from wallet" sends a Wirex cardholder's holding, by the address a
 * deposit of that token on that chain would use:
 *
 * - `card`: the card deposit address (a `RAIN_CARD` session), for an own row —
 *   Fuse, and USDT on Base, which our own pipeline keeps; and every row off
 *   Base while the backend has rhino.fi off;
 * - `rhino`: the user's rhino.fi address for the row, with rhino.fi's limits —
 *   its wallet route, paying the Safe on Base (USDT as USDC);
 * - `loading` / `unavailable`: rhino.fi's routes are not in, or cannot be had;
 * - `none`: nothing to send it to, or nothing a move would change: a holding
 *   on the chain rhino.fi pays out on (USDC on Base) already sits in the Safe
 *   it would be delivered to, and sending it out and back only costs the fees.
 *
 * Every holding is an ERC-20 (`getCardFundRoutes` lists USDC and USDT only), so
 * none is the native ETH that rhino.fi does not detect when a contract — the
 * Safe — sends it on Base.
 */
export type WirexMoveDestination =
  | { kind: 'card' }
  | { kind: 'rhino'; selection: RhinoDepositSelection; minimumUsd: number; maximumUsd: number }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'none' };

export const resolveWirexMoveDestination = (
  rhino: RhinoAssetsState,
  holding: { chainId: number; symbol: string },
): WirexMoveDestination => {
  const destinationType = getCardFundRhinoDestination(holding.symbol, CardProvider.WIREX);
  const row = resolveRhinoRow(rhino, {
    chainId: holding.chainId,
    destinationType,
    symbol: holding.symbol,
  });
  if (row.kind === 'own') {
    // With rhino.fi off every row is ours, and the card deposit address
    // delivers a Wirex cardholder's dollars to their Safe on Base: one already
    // there has nothing to move, as when rhino.fi would deliver it.
    const isAlreadyDelivered =
      rhino.status === 'disabled' &&
      holding.chainId === base.id &&
      !isOwnPipelineToken(holding.symbol, destinationType, holding.chainId);
    return isAlreadyDelivered ? { kind: 'none' } : { kind: 'card' };
  }
  if (row.kind !== 'rhino') return row;

  const found = findRhinoRoute(rhino.assets, row.selection);
  if (!found || found.route.receiveChainId === holding.chainId) return { kind: 'none' };
  return {
    kind: 'rhino',
    selection: row.selection,
    minimumUsd: found.route.minimumUsd,
    maximumUsd: found.route.maximumUsd,
  };
};

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
   * Crypto sold for USDC on the way to the card (BTC; see
   * `getCardFundCryptoRows`), through rhino.fi's card route.
   */
  crypto: boolean;
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
  crypto: true,
  cashDeposit: true,
  localCurrencies: true,
  moveFromSolid: true,
  externalWallet: true,
};

/**
 * Wirex cards offer direct stablecoin deposits, the local-currency onramp, and
 * moving what the cardholder already holds in Solid. Not crypto (see below).
 *
 * Local currencies work because the onramp needs no leg of its own: TransFi has
 * no USDC-on-Fuse entry, so the backend points the delivery at the same card
 * deposit address the stablecoin rows hand out, and the direct-deposit pipeline
 * carries it to the cardholder's Safe from there.
 *
 * `moveFromSolid` is on for the same reason: the app transfers from the
 * cardholder's Safe to the address a deposit of that token would use (rhino.fi's,
 * which pays USDT out as USDC; the card deposit address on Fuse and for USDT on
 * Base) and the rest happens as for any
 * deposit. That is deliberately *not* the Rain mechanic (approve, then a backend
 * pull via `POST /deposit`). See `WirexMoveFromWallet`.
 *
 * `cashDeposit` and `externalWallet` still need their own backend legs pointed at
 * Fuse, so they stay off rather than being offered and then failing with no
 * destination.
 */
export const WIREX_CARD_FUND_SECTIONS: CardFundSections = {
  stablecoins: true,
  // A Wirex cardholder's deposits off Fuse go to the Safe on Base through
  // rhino.fi's wallet route, which pays BTC out as WBTC, not dollars the card
  // can spend. Their wallet takes BTC already.
  crypto: false,
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
