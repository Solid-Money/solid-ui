import { arbitrum, base, bsc, mainnet, polygon } from 'viem/chains';

import { BRIDGE_TOKENS, EURC_TOKENS } from '@/constants/bridge';
import {
  baseEurcSpendableAsset,
  CARD_SPENDABLE_ASSETS,
  describeCardSpendableAssets,
} from '@/constants/cardSpendableAssets';
import { RHINO_ASSETS, RHINO_ASSETS_WITH_USDT_ROUTES } from '@/lib/__tests__/rhinoFixtures';
import { RhinoAssetsState } from '@/lib/rhinoDeposit';
import { CardProvider, TokenBalance, TokenType } from '@/lib/types';
import {
  CARD_FUND_EURC_SYMBOL,
  CARD_FUND_MOVE_COPY,
  CARD_FUND_TOKEN_SYMBOLS,
  getCardFundChains,
  getCardFundRhinoDestination,
  getCardFundRoutes,
  getCardFundRoutesTooltip,
  getCardFundSupportedNetworkNames,
  RAIN_CARD_FUND_SECTIONS,
  resolveWirexMoveDestination,
  WIREX_CARD_FUND_SECTIONS,
} from '@/lib/utils/cardFunding';
import { getMovableHoldings } from '@/lib/utils/cardFundMove';

describe('getCardFundRoutes', () => {
  it('offers every stablecoin the flow lists', () => {
    const symbols = new Set(getCardFundRoutes().map(route => route.symbol));

    for (const symbol of CARD_FUND_TOKEN_SYMBOLS) {
      expect(symbols).toContain(symbol);
    }
  });

  it('carries the contract the backend whitelists for each route', () => {
    for (const route of getCardFundRoutes()) {
      expect(route.address).toBe(BRIDGE_TOKENS[route.chainId]?.tokens?.[route.symbol]?.address);
    }
  });

  it('leaves out chains that are still coming soon', () => {
    const comingSoon = Object.entries(BRIDGE_TOKENS)
      .filter(([, chain]) => chain.isComingSoon)
      .map(([id]) => Number(id));

    for (const route of getCardFundRoutes()) {
      expect(comingSoon).not.toContain(route.chainId);
    }
  });

  it('never offers to move what the card already spends', () => {
    // The round-trip guard, against the real tables rather than a fixture: an
    // asset that is both card-spendable and a fund route would otherwise be
    // offered as a "move" that bridges out and back to the same balance.
    for (const asset of CARD_SPENDABLE_ASSETS) {
      for (const address of asset.addresses ?? []) {
        for (const chainId of asset.chainIds ?? []) {
          const holding: TokenBalance = {
            contractTickerSymbol: asset.symbol ?? 'TOKEN',
            contractName: asset.symbol ?? 'Token',
            contractAddress: address,
            balance: '5000000',
            contractDecimals: 6,
            quoteRate: 1,
            type: TokenType.ERC20,
            chainId,
          };

          expect(getMovableHoldings([holding], getCardFundRoutes(), CARD_SPENDABLE_ASSETS)).toEqual(
            [],
          );
        }
      }
    }
  });
});

describe('getCardFundRoutesTooltip', () => {
  it('names only networks the flow actually accepts', () => {
    const tooltip = getCardFundRoutesTooltip();
    const offered = new Set(getCardFundRoutes().map(route => route.chainId));

    for (const [id, chain] of Object.entries(BRIDGE_TOKENS)) {
      if (offered.has(Number(id))) continue;
      // Base is a substring of "Base Sepolia"; only assert on names that cannot
      // appear as part of an offered one.
      const collides = [...offered].some(offeredId =>
        BRIDGE_TOKENS[offeredId]?.name?.includes(chain.name),
      );
      if (collides) continue;
      expect(tooltip).not.toContain(chain.name);
    }
  });

  it('names every network the flow does accept', () => {
    const tooltip = getCardFundRoutesTooltip();

    for (const name of getCardFundSupportedNetworkNames()) {
      expect(tooltip).toContain(name);
    }
  });

  it('warns against depositing to the wallet address', () => {
    // The failure that costs a Wirex cardholder two days: money that arrives
    // safely in Wallet and cannot be spent.
    expect(getCardFundRoutesTooltip()).toContain('wallet address');
  });

  it('says nothing about EURC unless it is offered', () => {
    expect(getCardFundRoutesTooltip()).not.toContain(CARD_FUND_EURC_SYMBOL);
  });

  it('gives EURC its own, narrower list of networks', () => {
    const tooltip = getCardFundRoutesTooltip([...CARD_FUND_TOKEN_SYMBOLS, CARD_FUND_EURC_SYMBOL]);

    expect(tooltip).toContain('USDC or USDT only, on ');
    expect(tooltip).toContain('; EURC only on Base.');
    expect(tooltip).toContain('wallet address');
  });
});

describe('EURC', () => {
  it('is offered on Base only, Ethereum being held back for now', () => {
    expect(getCardFundChains(CARD_FUND_EURC_SYMBOL).map(chain => chain.chainId)).toEqual([base.id]);
  });

  it('stays out of BRIDGE_TOKENS, which every other deposit surface offers from', () => {
    for (const chain of Object.values(BRIDGE_TOKENS)) {
      expect(chain.tokens?.[CARD_FUND_EURC_SYMBOL]).toBeUndefined();
    }
  });

  it('is not a dollar stablecoin the flow may deliver as another', () => {
    expect(CARD_FUND_TOKEN_SYMBOLS).not.toContain(CARD_FUND_EURC_SYMBOL);
  });

  it('is never a move-from-wallet route', () => {
    // Base EURC already sits in the Safe the euro balance is spent from.
    expect(getCardFundRoutes().map(route => route.symbol)).not.toContain(CARD_FUND_EURC_SYMBOL);
  });

  it('carries the 6-decimal contract the backend accepts', () => {
    expect(EURC_TOKENS[mainnet.id]).toBeUndefined();
    expect(EURC_TOKENS[base.id]).toMatchObject({
      address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
      decimals: 6,
    });
  });
});

describe('describeCardSpendableAssets', () => {
  it('lists every spendable asset and the network it settles on', () => {
    const described = describeCardSpendableAssets();

    for (const asset of CARD_SPENDABLE_ASSETS) {
      expect(described).toContain(asset.symbol);
    }
    expect(described).toContain('Fuse');
  });

  it('names each network when the assets span more than one', () => {
    expect(
      describeCardSpendableAssets([
        { symbol: 'USDC', chainIds: [122] },
        { symbol: 'USDT', chainIds: [1] },
      ]),
    ).toBe('USDC on Fuse and USDT on Ethereum');
  });

  it('says EURC on Base pays euro purchases only, once it is spendable', () => {
    // Without the qualifier the sentence would promise EURC covers a dollar purchase, which
    // routing sends to Fuse instead.
    expect(
      describeCardSpendableAssets([...CARD_SPENDABLE_ASSETS, baseEurcSpendableAsset(['0xeurc'])]),
    ).toBe('USDC, USDT and soUSD on Fuse and EURC on Base for euro purchases');
  });

  it('drops the network clause for an asset not bound to one chain', () => {
    expect(
      describeCardSpendableAssets([{ symbol: 'USDC', chainIds: [122, 1] }, { symbol: 'USDT' }]),
    ).toBe('USDC and USDT');
  });

  it('handles a single asset', () => {
    expect(describeCardSpendableAssets([{ symbol: 'soUSD', chainIds: [122] }])).toBe(
      'soUSD on Fuse',
    );
  });

  it('is empty when nothing is configured', () => {
    expect(describeCardSpendableAssets([])).toBe('');
  });
});

describe('card fund sections', () => {
  it('offers moving from Solid on both issuers', () => {
    // Wirex cardholders had no in-app route from Wallet to card at all, which is
    // what left deposits on the wrong chain stranded.
    expect(RAIN_CARD_FUND_SECTIONS.moveFromSolid).toBe(true);
    expect(WIREX_CARD_FUND_SECTIONS.moveFromSolid).toBe(true);
  });

  it('keeps the Wirex methods with no Fuse-pointed backend leg switched off', () => {
    expect(WIREX_CARD_FUND_SECTIONS.cashDeposit).toBe(false);
    expect(WIREX_CARD_FUND_SECTIONS.externalWallet).toBe(false);
  });

  it('does not promise Wirex cardholders they can move savings', () => {
    // A Wirex card settles from soUSD on Fuse directly, so savings is already
    // spendable — there is nothing there to move, and saying otherwise sends the
    // user looking for a row the flow will not show them.
    expect(CARD_FUND_MOVE_COPY.wirex.title).not.toMatch(/savings/i);
    expect(CARD_FUND_MOVE_COPY.rain.title).toMatch(/savings/i);
  });
});

describe('getCardFundRhinoDestination', () => {
  it('matches a Rain card’s dollar rows against rhino.fi’s card route', () => {
    for (const symbol of CARD_FUND_TOKEN_SYMBOLS) {
      expect(getCardFundRhinoDestination(symbol, CardProvider.RAIN)).toBe('RAIN_CARD');
      expect(getCardFundRhinoDestination(symbol, null)).toBe('RAIN_CARD');
    }
  });

  // Their card deposits off Fuse land in the Safe on Base, where the wallet route pays.
  it('matches a Wirex card’s dollar rows against rhino.fi’s wallet route', () => {
    for (const symbol of CARD_FUND_TOKEN_SYMBOLS) {
      expect(getCardFundRhinoDestination(symbol, CardProvider.WIREX)).toBe('WALLET');
    }
  });

  // No card route takes EURC, and the card address only ever delivered it to
  // the Safe on Base, which is where rhino.fi's wallet route pays.
  it('matches EURC against rhino.fi’s wallet route, whoever issued the card', () => {
    expect(getCardFundRhinoDestination(CARD_FUND_EURC_SYMBOL, CardProvider.RAIN)).toBe('WALLET');
    expect(getCardFundRhinoDestination(CARD_FUND_EURC_SYMBOL, CardProvider.WIREX)).toBe('WALLET');
  });
});

/**
 * "Move from wallet" sends a Wirex cardholder's holding where a deposit of it
 * would go: rhino.fi's wallet route for USDC, the card address for USDT.
 */
describe('resolveWirexMoveDestination', () => {
  const READY: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };

  it('moves USDC through rhino.fi’s wallet route, with its limits', () => {
    [mainnet.id, polygon.id, arbitrum.id, bsc.id].forEach(chainId =>
      expect(resolveWirexMoveDestination(READY, { chainId, symbol: 'USDC' })).toMatchObject({
        kind: 'rhino',
        selection: { chainId, tokenSymbol: 'USDC', destinationType: 'WALLET' },
        minimumUsd: 5,
        maximumUsd: 100000,
      }),
    );
  });

  // It already sits in the Safe on Base that rhino.fi would deliver it to.
  it('does not move USDC already on Base', () => {
    expect(resolveWirexMoveDestination(READY, { chainId: base.id, symbol: 'USDC' })).toEqual({
      kind: 'none',
    });
  });

  // Our own pipeline: the card address, which the backend delivers to the Safe
  // on Base. Not rhino.fi's, even from a backend still listing USDT routes.
  it('moves USDT to the card deposit address, whatever rhino.fi lists or says', () => {
    const states: RhinoAssetsState[] = [
      READY,
      { status: 'ready', assets: RHINO_ASSETS_WITH_USDT_ROUTES },
      { status: 'loading' },
      { status: 'unavailable' },
    ];
    states.forEach(state =>
      [mainnet.id, polygon.id, arbitrum.id, bsc.id].forEach(chainId =>
        expect(resolveWirexMoveDestination(state, { chainId, symbol: 'USDT' })).toEqual({
          kind: 'card',
        }),
      ),
    );
  });

  it('waits for rhino.fi’s routes, and has nowhere to send USDC without them', () => {
    const holding = { chainId: mainnet.id, symbol: 'USDC' };
    expect(resolveWirexMoveDestination({ status: 'loading' }, holding)).toEqual({
      kind: 'loading',
    });
    expect(resolveWirexMoveDestination({ status: 'unavailable' }, holding)).toEqual({
      kind: 'unavailable',
    });
    const noEthereum: RhinoAssetsState = {
      status: 'ready',
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'ETHEREUM'),
      },
    };
    expect(resolveWirexMoveDestination(noEthereum, holding)).toEqual({ kind: 'none' });
  });
});
