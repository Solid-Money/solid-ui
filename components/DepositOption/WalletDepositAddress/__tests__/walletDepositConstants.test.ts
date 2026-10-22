import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import {
  formatWalletDepositMinimum,
  getAllWalletDepositTokens,
  getDefaultWalletDepositSelection,
  getWalletDepositMinimum,
  getWalletDepositNetworks,
  getWalletDepositNetworksForToken,
  getWalletDepositTokenIcon,
  getWalletDepositTokens,
  groupWalletDepositTokens,
  matchesWalletDepositSearch,
  offersWalletDepositEurc,
  resolveWalletDepositChain,
  resolveWalletDepositMinimum,
  resolveWalletDepositSymbol,
  usesDirectDepositAddress,
} from '@/components/DepositOption/WalletDepositAddress/constants';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { isWalletDepositContract, WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';
import { CardProvider, DepositAsset } from '@/lib/types';

// The module resolves icons through the asset barrel; what is under test is
// which chains and currencies are offered and what each pairing's floor is.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));
// qa/preview builds, where SLVx is offered; production is in its own file.
jest.mock('@/lib/config', () => ({
  ...jest.requireActual('@/lib/config'),
  isDevFeatureEnabled: true,
}));

const symbolsOf = (tokens: { symbol: string }[]) => tokens.map(token => token.symbol);
const chainIdsOf = (networks: { chainId: number }[]) => networks.map(network => network.chainId);

describe('getWalletDepositMinimum', () => {
  it('asks for more on Ethereum than on the chains its deposits are cheap to move on', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'USDC')).toBe('10');
    expect(getWalletDepositMinimum(base.id, 'USDC')).toBe('1');
    expect(getWalletDepositMinimum(arbitrum.id, 'USDT')).toBe('1');
    expect(getWalletDepositMinimum(optimism.id, 'USDC')).toBe('1');
  });

  // A floor is a number of tokens, so an asset that is not worth ~$1 a unit needs
  // its own — 10 ETH would be an absurd minimum, 1 FUSE a meaningless one.
  it('overrides the chain floor for currencies that are not worth ~$1 a unit', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'ETH')).toBe('0.005');
    expect(getWalletDepositMinimum(mainnet.id, 'WETH')).toBe('0.005');
    expect(getWalletDepositMinimum(fuse.id, 'FUSE')).toBe('500');
    expect(getWalletDepositMinimum(mainnet.id, 'WBTC')).toBe('0.00015');
    expect(getWalletDepositMinimum(optimism.id, 'OP')).toBe('80');
  });

  // Each currency the screen offers has a floor of its own, so none quotes the
  // chain's — "Send at least 10 WBTC" on Ethereum.
  it('has a floor for every currency that is not a dollar or euro stablecoin', () => {
    const stablecoins = new Set(['USDC', 'USDT', 'EURC']);
    WALLET_DEPOSIT_TOKENS.filter(token => !stablecoins.has(token.symbol)).forEach(token => {
      expect(getWalletDepositMinimum(mainnet.id, token.symbol)).not.toBe(
        getWalletDepositMinimum(mainnet.id, 'USDC'),
      );
    });
  });

  // The same asset on a cheaper chain: the override is by symbol, so Base does
  // not quote 1 ETH from its chain floor.
  it('floors ETH and WETH on Base the same as on Ethereum', () => {
    expect(getWalletDepositMinimum(base.id, 'ETH')).toBe('0.005');
    expect(getWalletDepositMinimum(base.id, 'WETH')).toBe('0.005');
  });

  it('falls back to a floor rather than none for an unlisted chain', () => {
    expect(getWalletDepositMinimum(999_999, 'USDC')).toBe('1');
  });
});

describe('formatWalletDepositMinimum', () => {
  it('prints whole and short floors as they are', () => {
    expect(formatWalletDepositMinimum('10')).toBe('10');
    expect(formatWalletDepositMinimum('0.005')).toBe('0.005');
    expect(formatWalletDepositMinimum('48.33')).toBe('48.33');
  });

  // Four decimals would print 0.0001194 WBTC as 0.0001 — under the floor.
  it('keeps two significant figures for an asset worth thousands a unit', () => {
    expect(formatWalletDepositMinimum('0.0001194')).toBe('0.00012');
    expect(formatWalletDepositMinimum('0.00015')).toBe('0.00015');
  });

  it('rounds up, never down', () => {
    expect(formatWalletDepositMinimum('0.002422')).toBe('0.0025');
    expect(formatWalletDepositMinimum('1.23451')).toBe('1.2346');
  });

  // A floor a hair above a display step: a float with a tolerance printed the
  // step below it, which is under the floor.
  it('rounds up a floor however little it is over a step', () => {
    expect(formatWalletDepositMinimum('0.0050000000001')).toBe('0.0051');
    expect(formatWalletDepositMinimum('10.000000000000000001')).toBe('10.0001');
  });

  it('leaves a floor that is already on a step as it is', () => {
    expect(formatWalletDepositMinimum('0.1')).toBe('0.1');
    expect(formatWalletDepositMinimum('0.001')).toBe('0.001');
    expect(formatWalletDepositMinimum('500')).toBe('500');
  });

  it('groups the thousands of a large floor', () => {
    expect(formatWalletDepositMinimum('1107.5')).toBe('1,107.5');
  });
});

describe('getWalletDepositTokens', () => {
  it('lists the currencies the chain actually carries', () => {
    expect(symbolsOf(getWalletDepositTokens(polygon.id))).toEqual([
      'USDC',
      'USDT',
      'WBTC',
      'UNI',
      'AAVE',
      'SOL',
      'WETH',
    ]);
    expect(symbolsOf(getWalletDepositTokens(fuse.id))).toEqual(['USDC', 'USDT', 'FUSE', 'WFUSE']);
    expect(symbolsOf(getWalletDepositTokens(optimism.id))).toEqual([
      'USDC',
      'USDT',
      'ETH',
      'WBTC',
      'UNI',
      'ENA',
      'AAVE',
      'WLD',
      'OP',
      'WETH',
    ]);
  });

  // Base's USDT, ETH and the rest are offered here only: `BRIDGE_TOKENS[base.id]`
  // stays USDC alone, so card funding, savings and bridging are unchanged.
  it('offers currencies beyond what BRIDGE_TOKENS lists for the chain', () => {
    expect(Object.keys(BRIDGE_TOKENS[base.id].tokens ?? {})).toEqual(['USDC']);
    expect(symbolsOf(getWalletDepositTokens(base.id))).toEqual(
      expect.arrayContaining(['USDC', 'USDT', 'ETH', 'WETH', 'WBTC', 'cbBTC', 'SOL']),
    );
    expect(BRIDGE_TOKENS[optimism.id]).toBeUndefined();
  });

  it('returns nothing for a chain that is not supported', () => {
    expect(getWalletDepositTokens(999_999)).toEqual([]);
  });
});

describe('getWalletDepositTokenIcon', () => {
  it("draws each currency with its own mark, whatever the chain's entry carries", () => {
    expect(getWalletDepositTokenIcon('USDC')).toBe('images/usdc-4x.png');
    expect(getWalletDepositTokenIcon('PAXG')).toBe('images/paxg.png');
    expect(getWalletDepositTokenIcon('OP')).toBe('images/op.png');
  });

  it('falls back to the USDC mark for a currency it does not know', () => {
    expect(getWalletDepositTokenIcon('DOGE')).toBe('images/usdc-4x.png');
  });
});

describe('getWalletDepositNetworks', () => {
  it('offers only chains with a currency to deposit, in display order', () => {
    expect(chainIdsOf(getWalletDepositNetworks())).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      optimism.id,
      bsc.id,
      fuse.id,
    ]);
  });

  // Optimism is not a bridge source, so its name and icon come from elsewhere.
  it('names a chain that is not in BRIDGE_TOKENS', () => {
    const optimismNetwork = getWalletDepositNetworks().find(n => n.chainId === optimism.id);
    expect(optimismNetwork?.name).toBe('Optimism');
    expect(optimismNetwork?.icon).toBeTruthy();
  });
});

/**
 * Which address the screen hands out. The minted one is watched by the deposit
 * pipeline and resolves by issuer; the Safe is neither. Getting this wrong
 * either strands a transfer or sends it to someone's card instead of their
 * wallet.
 */
describe('usesDirectDepositAddress', () => {
  it('mints for a Wirex cardholder sending a stablecoin', () => {
    expect(usesDirectDepositAddress('USDC', CardProvider.WIREX)).toBe(true);
    expect(usesDirectDepositAddress('USDT', CardProvider.WIREX)).toBe(true);
    expect(usesDirectDepositAddress('EURC', CardProvider.WIREX)).toBe(true);
  });

  // Minting resolves by issuer: for Rain it would deliver to the card, and with
  // no card there is no issuer to resolve. Both see the Safe, for everything.
  it('keeps the Safe for everyone who is not a Wirex cardholder', () => {
    expect(usesDirectDepositAddress('USDC', CardProvider.RAIN)).toBe(false);
    expect(usesDirectDepositAddress('USDC', null)).toBe(false);
    expect(usesDirectDepositAddress('USDC', undefined)).toBe(false);
  });

  // These have no route through the pipeline — they land in the Safe and stay as
  // the token that was sent, so there the Safe is the right answer.
  it('keeps the Safe for the currencies with no route, even for Wirex', () => {
    ['ETH', 'WETH', 'FUSE', 'WFUSE', 'PAXG', 'WBTC', 'SOL', 'OP'].forEach(symbol => {
      expect(usesDirectDepositAddress(symbol, CardProvider.WIREX)).toBe(false);
    });
  });
});

describe('resolveWalletDepositMinimum', () => {
  const asset = (over: Partial<DepositAsset>): DepositAsset => ({
    chainId: mainnet.id,
    chainName: 'Ethereum',
    symbol: 'USDC',
    address: '0x0',
    decimals: 6,
    minimum: '10',
    ...over,
  });

  // The pipeline's figure is the only enforced one, so it wins whenever present.
  it('prefers the published minimum over the committed estimate', () => {
    const assets = [asset({ symbol: 'USDC', minimum: '25' })];
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', assets)).toBe('25');
  });

  it('falls back when the pipeline has not answered', () => {
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', undefined)).toBe('10');
    expect(resolveWalletDepositMinimum(base.id, 'USDC', [])).toBe('1');
  });

  // The pipeline credits the wrapped contract; the screen offers the native.
  it('matches a native asset through its wrapped equivalent', () => {
    const assets = [
      asset({ symbol: 'WETH', minimum: '0.004', decimals: 18 }),
      asset({ chainId: fuse.id, chainName: 'Fuse', symbol: 'WFUSE', minimum: '500' }),
    ];

    expect(resolveWalletDepositMinimum(mainnet.id, 'ETH', assets)).toBe('0.004');
    expect(resolveWalletDepositMinimum(mainnet.id, 'WETH', assets)).toBe('0.004');
    expect(resolveWalletDepositMinimum(fuse.id, 'FUSE', assets)).toBe('500');
  });

  // BNB Chain has no WETH to publish: its ETH is itself a token.
  it('takes the currency’s own entry where there is no wrapped one', () => {
    const assets = [
      asset({ chainId: bsc.id, chainName: 'BNB Chain', symbol: 'ETH', minimum: '0.0041' }),
    ];
    expect(resolveWalletDepositMinimum(bsc.id, 'ETH', assets)).toBe('0.0041');
  });

  it('quotes the published floor of a currency that lands in the Safe', () => {
    const assets = [
      asset({ chainId: arbitrum.id, chainName: 'Arbitrum', symbol: 'WBTC', minimum: '0.0001194' }),
    ];
    expect(resolveWalletDepositMinimum(arbitrum.id, 'WBTC', assets)).toBe('0.0001194');
  });

  it('does not take a published minimum from the wrong chain', () => {
    const assets = [asset({ chainId: base.id, chainName: 'Base', minimum: '99' })];
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', assets)).toBe('10');
  });

  // A malformed or zero figure would quote "Send at least 0", which is no floor.
  it('ignores a published minimum that is not a usable number', () => {
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', [asset({ minimum: '0' })])).toBe('10');
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', [asset({ minimum: 'n/a' })])).toBe('10');
  });
});

describe('resolveWalletDepositSymbol', () => {
  it('carries a currency over to a chain that accepts it', () => {
    expect(resolveWalletDepositSymbol(base.id, 'USDC')).toBe('USDC');
    expect(resolveWalletDepositSymbol(base.id, 'USDT')).toBe('USDT');
    expect(resolveWalletDepositSymbol(base.id, 'ETH')).toBe('ETH');
    expect(resolveWalletDepositSymbol(arbitrum.id, 'WBTC')).toBe('WBTC');
  });

  // Otherwise the screen would quote a minimum for a pairing that does not exist.
  it('falls back when the chain does not carry it', () => {
    expect(resolveWalletDepositSymbol(polygon.id, 'ETH')).toBe('USDC');
    expect(resolveWalletDepositSymbol(base.id, 'FUSE')).toBe('USDC');
    expect(resolveWalletDepositSymbol(fuse.id, 'ETH')).toBe('USDC');
    expect(resolveWalletDepositSymbol(arbitrum.id, 'OP')).toBe('USDC');
  });

  it("picks the chain's first currency when none was chosen yet", () => {
    expect(resolveWalletDepositSymbol(mainnet.id, undefined)).toBe('USDC');
  });

  it('has nothing to offer for an unsupported chain', () => {
    expect(resolveWalletDepositSymbol(999_999, 'USDC')).toBeUndefined();
  });
});

describe('getDefaultWalletDepositSelection', () => {
  /**
   * Base: it carries nearly every currency on offer, at a fraction of
   * Ethereum's gas. The address shown is the user's Safe on whichever chain is
   * picked — it is not a bridge — so a deposit made on the default lands on the
   * default.
   */
  it('opens on USDC over Base', () => {
    expect(getDefaultWalletDepositSelection()).toEqual({ chainId: base.id, symbol: 'USDC' });
  });

  it('offers USDC on the chain it opens on', () => {
    const { chainId, symbol } = getDefaultWalletDepositSelection();
    expect(symbolsOf(getWalletDepositTokens(chainId))).toContain(symbol);
  });
});

describe('getAllWalletDepositTokens', () => {
  it('lists every currency some chain accepts, once', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens());
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  // The design's order: stablecoins, gold and silver, then ETH first among the
  // crypto, Mark's list after it, and the wrapped natives last.
  it('lists them in the order "Select token" shows them', () => {
    expect(symbolsOf(getAllWalletDepositTokens())).toEqual([
      'USDC',
      'USDT',
      'PAXG',
      'SLVx',
      'ETH',
      'WBTC',
      'FUSE',
      'cbBTC',
      'ZEC',
      'UNI',
      'NEAR',
      'ENA',
      'AAVE',
      'SOL',
      'WLD',
      'ARB',
      'OP',
      'WETH',
      'WFUSE',
    ]);
  });

  it('carries the full name each row shows under the ticker', () => {
    const names = Object.fromEntries(
      getAllWalletDepositTokens().map(token => [token.symbol, token.name]),
    );
    expect(names).toMatchObject({
      USDC: 'USD Coin',
      PAXG: 'Gold',
      SLVx: 'Silver',
      WBTC: 'Wrapped Bitcoin',
      cbBTC: 'Coinbase Wrapped BTC',
      WFUSE: 'Wrapped FUSE',
    });
  });
});

describe('groupWalletDepositTokens', () => {
  it('puts each currency under its heading, in the design’s order', () => {
    const groups = groupWalletDepositTokens(getAllWalletDepositTokens(CardProvider.WIREX));

    expect(groups.map(group => group.label)).toEqual(['Stablecoins', 'Gold & silver', 'Crypto']);
    expect(symbolsOf(groups[0].tokens)).toEqual(['USDC', 'USDT', 'EURC']);
    expect(symbolsOf(groups[1].tokens)).toEqual(['PAXG', 'SLVx']);
    expect(groups[2].tokens[0].symbol).toBe('ETH');
  });

  it('leaves out a group with nothing in it', () => {
    const btc = getAllWalletDepositTokens().filter(token =>
      matchesWalletDepositSearch(token, 'btc'),
    );
    expect(groupWalletDepositTokens(btc).map(group => group.label)).toEqual(['Crypto']);
  });
});

describe('matchesWalletDepositSearch', () => {
  const search = (query: string) =>
    symbolsOf(
      getAllWalletDepositTokens().filter(token => matchesWalletDepositSearch(token, query)),
    );

  it('matches a ticker, whatever the case', () => {
    expect(search('btc')).toEqual(['WBTC', 'cbBTC']);
    expect(search('USDC')).toEqual(['USDC']);
  });

  it('matches a name', () => {
    expect(search('bitcoin')).toEqual(['WBTC', 'cbBTC']);
    expect(search('gold')).toEqual(['PAXG']);
    expect(search('solana')).toEqual(['SOL']);
  });

  it('matches what a person might type instead', () => {
    expect(search('paxos')).toEqual(['PAXG']);
    expect(search('ethereum')).toEqual(['ETH']);
  });

  it('lists everything for an empty query, and nothing for a token not offered', () => {
    expect(search('  ')).toHaveLength(getAllWalletDepositTokens().length);
    expect(search('doge')).toEqual([]);
  });
});

describe('getWalletDepositNetworksForToken', () => {
  it('only offers the chains that carry the currency', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('ETH'))).toEqual([
      mainnet.id,
      base.id,
      arbitrum.id,
      optimism.id,
      bsc.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('WETH'))).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      optimism.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('FUSE'))).toEqual([fuse.id]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('OP'))).toEqual([optimism.id]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('ZEC'))).toEqual([bsc.id]);
  });

  it('offers every network a stablecoin is on', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC'))).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      optimism.id,
      bsc.id,
      fuse.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDT'))).toContain(base.id);
  });

  // A Wirex cardholder's stablecoins go through the pipeline, which mints no
  // address on Optimism — offering it there would show an address that fails.
  it("keeps a Wirex cardholder's stablecoins to the chains the pipeline mints on", () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', CardProvider.WIREX))).not.toContain(
      optimism.id,
    );
    expect(chainIdsOf(getWalletDepositNetworksForToken('ETH', CardProvider.WIREX))).toContain(
      optimism.id,
    );
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', CardProvider.RAIN))).toContain(
      optimism.id,
    );
  });

  it('offers every chain when no currency is chosen', () => {
    expect(getWalletDepositNetworksForToken(undefined)).toEqual(getWalletDepositNetworks());
  });
});

describe('resolveWalletDepositChain', () => {
  it('opens every currency Base carries on Base, unless it has a home of its own', () => {
    expect(resolveWalletDepositChain('USDC')).toBe(base.id);
    expect(resolveWalletDepositChain('USDT')).toBe(base.id);
    expect(resolveWalletDepositChain('ETH')).toBe(base.id);
    expect(resolveWalletDepositChain('WETH')).toBe(base.id);
    expect(resolveWalletDepositChain('cbBTC')).toBe(base.id);
  });

  it("opens a currency on its home chain, the one it's sent on", () => {
    expect(resolveWalletDepositChain('ARB')).toBe(arbitrum.id);
    expect(resolveWalletDepositChain('OP')).toBe(optimism.id);
    expect(resolveWalletDepositChain('WLD')).toBe(optimism.id);
    expect(resolveWalletDepositChain('PAXG')).toBe(mainnet.id);
    expect(resolveWalletDepositChain('ZEC')).toBe(bsc.id);
    expect(resolveWalletDepositChain('WBTC')).toBe(mainnet.id);
  });

  it('opens the Fuse currencies on Fuse, the only chain carrying them', () => {
    expect(resolveWalletDepositChain('FUSE')).toBe(fuse.id);
    expect(resolveWalletDepositChain('WFUSE')).toBe(fuse.id);
  });

  // Changing only the currency from the address screen should not move the chain.
  it('keeps the current chain when it carries the currency', () => {
    expect(resolveWalletDepositChain('USDC', polygon.id)).toBe(polygon.id);
    expect(resolveWalletDepositChain('ETH', mainnet.id)).toBe(mainnet.id);
    expect(resolveWalletDepositChain('WBTC', arbitrum.id)).toBe(arbitrum.id);
  });

  it('moves to Base when the current chain does not carry the currency', () => {
    expect(resolveWalletDepositChain('ETH', polygon.id)).toBe(base.id);
    expect(resolveWalletDepositChain('USDC', 999_999)).toBe(base.id);
  });
});

/**
 * EURC is offered to Wirex cardholders only, on Base only, and through the
 * minted address - the pipeline delivers it to their Safe on Base.
 */
describe('EURC', () => {
  it('is offered to Wirex cardholders only', () => {
    expect(offersWalletDepositEurc(CardProvider.WIREX)).toBe(true);
    expect(offersWalletDepositEurc(CardProvider.RAIN)).toBe(false);
    expect(offersWalletDepositEurc(null)).toBe(false);
    expect(offersWalletDepositEurc(undefined)).toBe(false);
  });

  it('is left out unless the cardholder is Wirex', () => {
    expect(symbolsOf(getAllWalletDepositTokens())).not.toContain('EURC');
    expect(symbolsOf(getAllWalletDepositTokens(CardProvider.RAIN))).not.toContain('EURC');
    expect(symbolsOf(getWalletDepositTokens(base.id))).not.toContain('EURC');
  });

  it('follows the other stablecoins in "Select token"', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(CardProvider.WIREX));
    expect(symbols.slice(0, 4)).toEqual(['USDC', 'USDT', 'EURC', 'PAXG']);
  });

  it('is offered on Base only', () => {
    expect(symbolsOf(getWalletDepositTokens(base.id, CardProvider.WIREX))).toContain('EURC');
    expect(symbolsOf(getWalletDepositTokens(mainnet.id, CardProvider.WIREX))).not.toContain('EURC');
    expect(chainIdsOf(getWalletDepositNetworksForToken('EURC', CardProvider.WIREX))).toEqual([
      base.id,
    ]);
  });

  it('opens on Base, whatever chain was showing', () => {
    expect(resolveWalletDepositChain('EURC', undefined, CardProvider.WIREX)).toBe(base.id);
    expect(resolveWalletDepositChain('EURC', fuse.id, CardProvider.WIREX)).toBe(base.id);
  });

  it('carries its own icon', () => {
    expect(getWalletDepositTokenIcon('EURC')).toBe('images/eurc.png');
  });
});

describe('isWalletDepositContract', () => {
  it('names each contract the screen offers, whatever the address case', () => {
    expect(isWalletDepositContract(arbitrum.id, '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f')).toBe(
      true,
    );
    expect(isWalletDepositContract(optimism.id, '0x4200000000000000000000000000000000000042')).toBe(
      true,
    );
  });

  it('matches on chain as well as address', () => {
    expect(isWalletDepositContract(fuse.id, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f')).toBe(
      false,
    );
  });

  it('names no native coin, which has no contract', () => {
    expect(isWalletDepositContract(mainnet.id, 'native')).toBe(false);
    expect(isWalletDepositContract(mainnet.id, undefined)).toBe(false);
  });
});
