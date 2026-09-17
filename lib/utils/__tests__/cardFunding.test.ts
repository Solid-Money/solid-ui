import { BRIDGE_TOKENS } from '@/constants/bridge';
import {
  CARD_SPENDABLE_ASSETS,
  describeCardSpendableAssets,
} from '@/constants/cardSpendableAssets';
import { TokenBalance, TokenType } from '@/lib/types';
import {
  CARD_FUND_MOVE_COPY,
  CARD_FUND_TOKEN_SYMBOLS,
  getCardFundRoutes,
  getCardFundRoutesTooltip,
  getCardFundSupportedNetworkNames,
  RAIN_CARD_FUND_SECTIONS,
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
});

describe('describeCardSpendableAssets', () => {
  it('lists every spendable asset and the network it settles on', () => {
    const described = describeCardSpendableAssets();

    for (const asset of CARD_SPENDABLE_ASSETS) {
      expect(described).toContain(asset.symbol);
    }
    expect(described).toContain('Fuse');
  });

  it('drops the network clause when the assets no longer share one chain', () => {
    expect(
      describeCardSpendableAssets([
        { symbol: 'USDC', chainIds: [122] },
        { symbol: 'USDT', chainIds: [1] },
      ]),
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
