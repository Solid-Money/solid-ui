import { parseUnits, zeroAddress } from 'viem';
import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType } from '@/lib/types';
import {
  CardFundRoute,
  getMovableHoldings,
  getSwappableHoldings,
  swapAmountFor,
} from '@/lib/utils/cardFundMove';

const BASE_USDC = BRIDGE_TOKENS[base.id].tokens!.USDC.address;
const BSC_USDT = BRIDGE_TOKENS[bsc.id].tokens!.USDT.address;
const ETH_USDC = BRIDGE_TOKENS[mainnet.id].tokens!.USDC.address;

/** The routes the funding flow actually offers, trimmed to what these cases need. */
const ROUTES: CardFundRoute[] = [
  { chainId: base.id, symbol: 'USDC', address: BASE_USDC, decimals: 6 },
  { chainId: bsc.id, symbol: 'USDT', address: BSC_USDT, decimals: 18 },
  { chainId: mainnet.id, symbol: 'USDC', address: ETH_USDC, decimals: 6 },
  { chainId: fuse.id, symbol: 'USDC', address: USDC_STARGATE, decimals: 6 },
  { chainId: fuse.id, symbol: 'USDT', address: USDT_STARGATE, decimals: 6 },
];

const token = (overrides: Partial<TokenBalance>): TokenBalance => ({
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: BASE_USDC,
  balance: '2000000', // 2 tokens at 6 decimals
  contractDecimals: 6,
  quoteRate: 1,
  type: TokenType.ERC20,
  chainId: base.id,
  ...overrides,
});

describe('getMovableHoldings', () => {
  it('offers a stablecoin the card cannot reach', () => {
    const [holding] = getMovableHoldings([token({})], ROUTES, CARD_SPENDABLE_ASSETS);

    expect(holding).toMatchObject({
      chainId: base.id,
      symbol: 'USDC',
      tokenAddress: BASE_USDC,
      decimals: 6,
      balance: '2000000',
      amount: 2,
      valueUSD: 2,
    });
  });

  it('leaves out what the card can already spend', () => {
    // The exact case that made sergomedes send his Base USDC out and back by
    // hand: the Fuse holding is already settling, only the Base one needs moving.
    const holdings = getMovableHoldings(
      [token({ chainId: fuse.id, contractAddress: USDC_STARGATE, balance: '78216359' }), token({})],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0].chainId).toBe(base.id);
  });

  it('leaves out soUSD, which the card settles from directly', () => {
    const holdings = getMovableHoldings(
      [
        token({
          chainId: fuse.id,
          contractTickerSymbol: 'soUSD',
          contractAddress: ADDRESSES.fuse.vault,
        }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toEqual([]);
  });

  it('ignores a token on no supported route', () => {
    const holdings = getMovableHoldings(
      [token({ chainId: 42161 }), token({ contractAddress: '0xdead' })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toEqual([]);
  });

  it('matches the whitelisted contract, not the ticker', () => {
    // A same-ticker impostor at another address is refunded by the backend, so
    // offering to move it would cost the user gas to get their token back.
    const holdings = getMovableHoldings(
      [token({ contractAddress: '0x1111111111111111111111111111111111111111' })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toEqual([]);
  });

  it('matches addresses case-insensitively', () => {
    const holdings = getMovableHoldings(
      [token({ contractAddress: BASE_USDC.toUpperCase() })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toHaveLength(1);
  });

  it('reports the 18-decimal balance of BNB Chain USDT at its real scale', () => {
    const holdings = getMovableHoldings(
      [
        token({
          chainId: bsc.id,
          contractTickerSymbol: 'USDT',
          contractAddress: BSC_USDT,
          contractDecimals: 18,
          balance: '16500000000000000000', // 16.5 at 18 decimals
        }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings[0]).toMatchObject({ amount: 16.5, decimals: 18, valueUSD: 16.5 });
  });

  it('drops a holding whose decimals the indexer and the bridge table disagree on', () => {
    // Two readings of one contract. Sizing an 18-decimal transfer as 6 sends a
    // millionth of the amount; the other way round reverts. Neither is a move
    // worth offering.
    const holdings = getMovableHoldings(
      [token({ contractDecimals: 18 })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings).toEqual([]);
  });

  it('drops zero balances', () => {
    expect(getMovableHoldings([token({ balance: '0' })], ROUTES, CARD_SPENDABLE_ASSETS)).toEqual(
      [],
    );
  });

  it('orders by USD value, richest first', () => {
    const holdings = getMovableHoldings(
      [
        token({ balance: '2000000' }),
        token({ chainId: mainnet.id, contractAddress: ETH_USDC, balance: '90000000' }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings.map(h => h.chainId)).toEqual([mainnet.id, base.id]);
  });

  it('falls back to token amount when nothing is priced', () => {
    const holdings = getMovableHoldings(
      [
        token({ quoteRate: undefined, balance: '2000000' }),
        token({
          chainId: mainnet.id,
          contractAddress: ETH_USDC,
          quoteRate: undefined,
          balance: '90000000',
        }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
    );

    expect(holdings.map(h => h.amount)).toEqual([90, 2]);
    expect(holdings.every(h => h.valueUSD === 0)).toBe(true);
  });

  it('is empty before balances have loaded', () => {
    expect(getMovableHoldings(undefined, ROUTES, CARD_SPENDABLE_ASSETS)).toEqual([]);
  });
});

describe('getSwappableHoldings', () => {
  const LIFI_CHAINS = [base.id, mainnet.id, arbitrum.id, polygon.id, bsc.id];

  const eth = (overrides: Partial<TokenBalance> = {}): TokenBalance =>
    token({
      contractTickerSymbol: 'ETH',
      contractName: 'Ethereum',
      contractAddress: zeroAddress,
      contractDecimals: 18,
      balance: '136940968058643879', // ~0.137 ETH
      quoteRate: 2830,
      type: TokenType.NATIVE,
      chainId: mainnet.id,
      ...overrides,
    });

  it('offers ETH on Ethereum, which neither the card nor a move can take', () => {
    // The case behind this list: ~$390 of ETH on Ethereum, and a "Move from
    // wallet" screen that said the wallet held nothing else.
    const [holding] = getSwappableHoldings([eth()], ROUTES, CARD_SPENDABLE_ASSETS, LIFI_CHAINS);

    expect(holding).toMatchObject({
      chainId: mainnet.id,
      symbol: 'ETH',
      tokenAddress: zeroAddress,
    });
    expect(holding.amount).toBeCloseTo(0.13694, 5);
    expect(holding.valueUSD).toBeCloseTo(387.54, 1);
  });

  it('leaves out what a move already carries, and what the card already spends', () => {
    const holdings = getSwappableHoldings(
      [token({}), token({ chainId: fuse.id, contractAddress: USDC_STARGATE })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
      [...LIFI_CHAINS, fuse.id],
    );

    expect(holdings).toEqual([]);
  });

  it('leaves out chains the swap form does not quote through LI.FI', () => {
    expect(
      getSwappableHoldings(
        [eth({ chainId: fuse.id, contractTickerSymbol: 'FUSE' })],
        ROUTES,
        CARD_SPENDABLE_ASSETS,
        LIFI_CHAINS,
      ),
    ).toEqual([]);
  });

  it('leaves out Solid savings shares', () => {
    const holdings = getSwappableHoldings(
      [
        token({ chainId: mainnet.id, contractTickerSymbol: 'soUSD', contractAddress: '0xabc' }),
        eth({ contractTickerSymbol: 'soETH', contractAddress: '0xdef' }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
      LIFI_CHAINS,
    );

    expect(holdings).toEqual([]);
  });

  it('leaves out dust and anything unpriced', () => {
    const holdings = getSwappableHoldings(
      [
        eth({ balance: '100000000000000' }), // 0.0001 ETH, about 28 cents
        token({
          chainId: polygon.id,
          contractTickerSymbol: 'SPAM',
          contractAddress: '0x5ba4',
          quoteRate: undefined,
        }),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
      LIFI_CHAINS,
    );

    expect(holdings).toEqual([]);
  });

  it('decides the $1 line exactly, on an 18-decimal balance', () => {
    // At $2000/ETH, 0.0005 ETH is $1.00 to the wei, and one wei less falls short.
    const atLine = eth({ balance: '500000000000000', quoteRate: 2000 });
    const belowLine = eth({ balance: '499999999999999', quoteRate: 2000 });

    expect(getSwappableHoldings([atLine], ROUTES, CARD_SPENDABLE_ASSETS, LIFI_CHAINS)).toHaveLength(
      1,
    );
    expect(getSwappableHoldings([belowLine], ROUTES, CARD_SPENDABLE_ASSETS, LIFI_CHAINS)).toEqual(
      [],
    );
  });

  it('skips a holding whose balance or decimals cannot be read', () => {
    const holdings = getSwappableHoldings(
      [eth({ balance: 'not-a-number' }), eth({ contractDecimals: Number.NaN })],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
      LIFI_CHAINS,
    );

    expect(holdings).toEqual([]);
  });

  it('orders by USD value, richest first', () => {
    const holdings = getSwappableHoldings(
      [
        token({
          chainId: polygon.id,
          contractTickerSymbol: 'POL',
          contractAddress: zeroAddress,
          contractDecimals: 18,
          balance: '50000000000000000000', // 50 POL
          quoteRate: 0.2,
        }),
        eth(),
      ],
      ROUTES,
      CARD_SPENDABLE_ASSETS,
      LIFI_CHAINS,
    );

    expect(holdings.map(h => h.symbol)).toEqual(['ETH', 'POL']);
  });

  it('is empty before balances have loaded', () => {
    expect(getSwappableHoldings(undefined, ROUTES, CARD_SPENDABLE_ASSETS, LIFI_CHAINS)).toEqual([]);
  });
});

/** What "Swap €20 of ETH" fills the swap form with. */
describe('swapAmountFor', () => {
  const holding = (balance: string, decimals = 18, priceUsd = 2000) => {
    const amount = Number(balance) / 10 ** decimals;
    return { balance, decimals, amount, valueUSD: amount * priceUsd };
  };

  it('rounds the amount up at six places, so the swap is never a fraction short', () => {
    // $20 at $2000/ETH is exactly 0.01 ETH; $20.001 needs a hair more.
    expect(swapAmountFor(20, holding('500000000000000000'))).toBe('0.01');
    expect(swapAmountFor(20.001, holding('500000000000000000'))).toBe('0.010001');
  });

  it('rounds up at the precision of a token with fewer than six places', () => {
    // Two decimals at $1,000 a token: $14 is 0.014, which must offer 0.02, not round to 0.01.
    expect(swapAmountFor(14, holding('10000', 2, 1000))).toBe('0.02');
    expect(swapAmountFor(1, holding('10000', 2, 1000))).toBe('0.01');
  });

  it('never offers more than the balance, to the wei', () => {
    // 0.1234567 ETH: rounding up at six places gives 0.123457, which they do not hold.
    const all = holding('123456700000000000');
    const offered = swapAmountFor(all.valueUSD, all);

    expect(offered).toBe('0.1234567');
    expect(parseUnits(offered!, 18)).toBeLessThanOrEqual(123456700000000000n);
  });

  it('offers nothing it cannot work out', () => {
    expect(
      swapAmountFor(20, { ...holding('500000000000000000'), balance: 'nope' }),
    ).toBeUndefined();
    expect(swapAmountFor(0, holding('500000000000000000'))).toBeUndefined();
    expect(swapAmountFor(20, { ...holding('0'), amount: 0, valueUSD: 0 })).toBeUndefined();
  });
});
