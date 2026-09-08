import { base, bsc, fuse, mainnet } from 'viem/chains';

import { USDC_STARGATE, USDT_STARGATE } from '@/constants/addresses';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { CARD_SPENDABLE_ASSETS } from '@/constants/cardSpendableAssets';
import { ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType } from '@/lib/types';
import { CardFundRoute, getMovableHoldings } from '@/lib/utils/cardFundMove';

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
