import { arbitrum, base, bsc, fuse, mainnet, optimism, polygon } from 'viem/chains';

import {
  formatWalletDepositMinimum,
  getAllWalletDepositTokens,
  getDefaultWalletDepositSelection,
  getWalletDepositExtraNetworks,
  getWalletDepositExtraRow,
  getWalletDepositMinimum,
  getWalletDepositNetworks,
  getWalletDepositNetworksForToken,
  getWalletDepositNetworksNotice,
  getWalletDepositRow,
  getWalletDepositTokenIcon,
  getWalletDepositTokens,
  getWalletOwnAddress,
  getWalletRhinoSelection,
  groupWalletDepositTokens,
  matchesWalletDepositSearch,
  resolveWalletDepositChain,
  resolveWalletDepositExtraChain,
  resolveWalletDepositMinimum,
  resolveWalletDepositSymbol,
} from '@/components/DepositOption/WalletDepositAddress/constants';
import { BRIDGE_TOKENS } from '@/constants/bridge';
import { isWalletDepositContract, WALLET_DEPOSIT_TOKENS } from '@/constants/walletDepositTokens';
import {
  RHINO_ASSETS,
  RHINO_ASSETS_WITH_BASE_USDT_ROUTES,
  RHINO_ASSETS_WITH_BITCOIN,
  rhinoRoute,
  rhinoToken,
} from '@/lib/__tests__/rhinoFixtures';
import { RhinoAssetsState } from '@/lib/rhinoDeposit';
import { CardProvider, DepositAsset, RhinoDepositAssetsResponse } from '@/lib/types';

// The module resolves icons through the asset barrel; what is under test is
// which chains and currencies are offered and what each pairing's floor is.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));

const symbolsOf = (tokens: { symbol: string }[]) => tokens.map(token => token.symbol);
/**
 * rhino.fi's routes as the backend lists them (see `rhinoFixtures`): every row
 * but Fuse's is decided by them.
 */
const READY: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS };
/** Everyone on rhino.fi's routes, without the new tokens. */
const BASIC = { rhino: READY };
/** Someone offered the new deposit tokens, as everyone is on qa/preview builds. */
const ALL = { hasNewTokens: true, rhino: READY };
/** Base's currencies, each the Safe there but ETH (see `getWalletOwnAddress`). */
const BASE_SYMBOLS = ['USDC', 'USDT', 'EURC', 'ETH', 'cbBTC', 'cbZEC', 'AAVE', 'SOL', 'WETH'];
/** rhino.fi's routes, less its ETH on Arbitrum. */
const withoutArbitrumEth = (): RhinoAssetsState => ({
  status: 'ready',
  assets: {
    ...RHINO_ASSETS,
    chains: RHINO_ASSETS.chains.map(chain =>
      chain.chain === 'ARBITRUM'
        ? { ...chain, tokens: chain.tokens.filter(token => token.symbol !== 'ETH') }
        : chain,
    ),
  },
});
const WIREX = { provider: CardProvider.WIREX, hasNewTokens: true, rhino: READY };
const RAIN = { provider: CardProvider.RAIN, hasNewTokens: true, rhino: READY };
const chainIdsOf = (networks: { chainId: number }[]) => networks.map(network => network.chainId);

describe('getWalletDepositMinimum', () => {
  it('asks for more on Ethereum than on the chains its deposits are cheap to move on', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'USDC')).toBe('10');
    expect(getWalletDepositMinimum(base.id, 'USDC')).toBe('1');
    expect(getWalletDepositMinimum(arbitrum.id, 'USDT')).toBe('1');
    expect(getWalletDepositMinimum(bsc.id, 'USDC')).toBe('1');
  });

  // A floor is a number of tokens, so an asset that is not worth ~$1 a unit needs
  // its own — 10 ETH would be an absurd minimum, 1 FUSE a meaningless one.
  it('overrides the chain floor for currencies that are not worth ~$1 a unit', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'ETH')).toBe('0.005');
    expect(getWalletDepositMinimum(mainnet.id, 'WETH')).toBe('0.005');
    expect(getWalletDepositMinimum(fuse.id, 'FUSE')).toBe('500');
    expect(getWalletDepositMinimum(base.id, 'cbBTC')).toBe('0.00015');
    expect(getWalletDepositMinimum(base.id, 'cbZEC')).toBe('0.01');
    expect(getWalletDepositMinimum(base.id, 'BTC')).toBe('0.00015');
  });

  // Each currency the screen offers has a floor of its own, so none quotes the
  // chain's — "Send at least 10 cbBTC" on Ethereum.
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
  // Off Base and Fuse, a chain carries what rhino.fi takes from it; Base and
  // Fuse are our own, and carry every currency they have a contract for.
  it('lists the currencies the chain actually carries', () => {
    expect(symbolsOf(getWalletDepositTokens(polygon.id, ALL))).toEqual(['USDC', 'USDT']);
    expect(symbolsOf(getWalletDepositTokens(fuse.id, ALL))).toEqual([
      'USDC',
      'USDT',
      'FUSE',
      'WFUSE',
    ]);
    // Not a chain of the list, though rhino.fi takes dollars there.
    expect(getWalletDepositTokens(optimism.id, ALL)).toEqual([]);
    expect(symbolsOf(getWalletDepositTokens(bsc.id, ALL))).toEqual(['USDC', 'USDT', 'ETH']);
    expect(symbolsOf(getWalletDepositTokens(arbitrum.id, ALL))).toEqual(['USDC', 'USDT', 'ETH']);
    // No WETH: rhino.fi takes none, and it would stay on Ethereum in the Safe.
    expect(symbolsOf(getWalletDepositTokens(mainnet.id, ALL))).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'ETH',
    ]);
    expect(symbolsOf(getWalletDepositTokens(base.id, ALL))).toEqual(BASE_SYMBOLS);
  });

  // Base's USDT, ETH and the rest are offered here only: `BRIDGE_TOKENS[base.id]`
  // stays USDC alone, so card funding, savings and bridging are unchanged.
  it('offers currencies beyond what BRIDGE_TOKENS lists for the chain', () => {
    expect(Object.keys(BRIDGE_TOKENS[base.id].tokens ?? {})).toEqual(['USDC']);
    expect(symbolsOf(getWalletDepositTokens(base.id, ALL))).toEqual(
      expect.arrayContaining(['USDC', 'USDT', 'ETH', 'WETH', 'cbBTC', 'cbZEC', 'SOL']),
    );
  });

  // Base and Fuse are our own, so they need nothing from rhino.fi; every other
  // chain is rhino.fi's, and waits for its routes.
  it('lists only what Base and Fuse take until rhino.fi’s routes are in', () => {
    expect(symbolsOf(getWalletDepositTokens(base.id, { hasNewTokens: true }))).toEqual(
      BASE_SYMBOLS,
    );
    expect(symbolsOf(getWalletDepositTokens(polygon.id, { hasNewTokens: true }))).toEqual([]);
    expect(symbolsOf(getWalletDepositTokens(fuse.id, { hasNewTokens: true }))).toEqual([
      'USDC',
      'USDT',
      'FUSE',
      'WFUSE',
    ]);
  });

  it('returns nothing for a chain that is not supported', () => {
    expect(getWalletDepositTokens(999_999, ALL)).toEqual([]);
  });
});

describe('getWalletDepositTokenIcon', () => {
  it("draws each currency with its own mark, whatever the chain's entry carries", () => {
    expect(getWalletDepositTokenIcon('USDC')).toBe('images/usdc-4x.png');
    expect(getWalletDepositTokenIcon('cbZEC')).toBe('images/zec.png');
    expect(getWalletDepositTokenIcon('SOL')).toBe('images/sol.png');
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
      bsc.id,
      fuse.id,
    ]);
  });

  // rhino.fi takes deposits on Optimism, but the list has no row there.
  it('offers no Optimism row', () => {
    expect(chainIdsOf(getWalletDepositNetworks(ALL))).not.toContain(optimism.id);
  });
});

/**
 * Which address an own row hands out. The minted one is watched by the deposit
 * pipeline and resolves by destination (and, for the card's, by issuer); the
 * Safe is neither. Getting this wrong either strands a transfer or sends it to
 * someone's card instead of their wallet.
 */
describe('getWalletOwnAddress', () => {
  const session = (destinationType: 'WALLET' | 'RAIN_CARD') => ({
    kind: 'session',
    destinationType,
  });

  it('mints a card address on Fuse for a Wirex cardholder sending a dollar stablecoin', () => {
    expect(getWalletOwnAddress(fuse.id, 'USDC', CardProvider.WIREX)).toEqual(session('RAIN_CARD'));
    expect(getWalletOwnAddress(fuse.id, 'USDT', CardProvider.WIREX)).toEqual(session('RAIN_CARD'));
  });

  // Minting the card address resolves by issuer: for Rain it would deliver to
  // the card, and with no card there is no issuer to resolve. Both see the Safe.
  it('keeps the Safe on Fuse for everyone who is not a Wirex cardholder', () => {
    [CardProvider.RAIN, null, undefined].forEach(provider => {
      expect(getWalletOwnAddress(fuse.id, 'USDC', provider)).toEqual({ kind: 'safe' });
      expect(getWalletOwnAddress(fuse.id, 'USDT', provider)).toEqual({ kind: 'safe' });
    });
  });

  // FUSE and WFUSE have no route through the pipeline — they land in the Safe
  // and stay as sent, so there the Safe is the right answer.
  it('keeps the Safe for the Fuse currencies with no route, even for Wirex', () => {
    ['FUSE', 'WFUSE'].forEach(symbol => {
      expect(getWalletOwnAddress(fuse.id, symbol, CardProvider.WIREX)).toEqual({ kind: 'safe' });
    });
  });

  // rhino.fi takes USDT off Base and pays it to the Safe as USDC: nothing of ours.
  it('mints nothing for USDT off Base and Fuse', () => {
    [mainnet.id, polygon.id, arbitrum.id, optimism.id, bsc.id].forEach(chainId => {
      [null, CardProvider.RAIN, CardProvider.WIREX].forEach(provider => {
        expect(getWalletOwnAddress(chainId, 'USDT', provider)).toBeUndefined();
      });
    });
  });

  // rhino.fi is not trusted to take USDT on Base, and the Safe can spend it.
  it('shows the Safe for USDT on Base', () => {
    [null, CardProvider.WIREX].forEach(provider => {
      expect(getWalletOwnAddress(base.id, 'USDT', provider)).toEqual({ kind: 'safe' });
    });
  });

  // Every other row off Base and Fuse is rhino.fi's.
  it('mints nothing for the rest off Base and Fuse', () => {
    [mainnet.id, polygon.id, arbitrum.id, bsc.id].forEach(chainId => {
      expect(getWalletOwnAddress(chainId, 'USDC', CardProvider.WIREX)).toBeUndefined();
    });
  });

  // Base is where every wallet deposit lands: rhino.fi would only pay it back
  // there, so it is the Safe, whoever sends it and whatever rhino.fi lists.
  it('shows the Safe on Base for every currency but ETH', () => {
    [null, CardProvider.WIREX, CardProvider.RAIN].forEach(provider =>
      ['USDC', 'EURC', 'cbBTC', 'WETH'].forEach(symbol =>
        expect(getWalletOwnAddress(base.id, symbol, provider)).toEqual({ kind: 'safe' }),
      ),
    );
  });

  // The card spends WETH, not ETH: our wallet deposit address on Base wraps it.
  it('mints the wallet address for ETH on Base, which wraps it', () => {
    [null, CardProvider.WIREX].forEach(provider => {
      expect(getWalletOwnAddress(base.id, 'ETH', provider)).toEqual(session('WALLET'));
      expect(getWalletOwnAddress(base.id, 'ETH', provider, { rhinoOff: true })).toEqual(
        session('WALLET'),
      );
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
    expect(resolveWalletDepositSymbol(base.id, 'USDC', ALL)).toBe('USDC');
    expect(resolveWalletDepositSymbol(base.id, 'USDT', ALL)).toBe('USDT');
    expect(resolveWalletDepositSymbol(base.id, 'ETH', ALL)).toBe('ETH');
    expect(resolveWalletDepositSymbol(bsc.id, 'ETH', ALL)).toBe('ETH');
  });

  // Otherwise the screen would quote a minimum for a pairing that does not exist.
  it('falls back when the chain does not carry it', () => {
    expect(resolveWalletDepositSymbol(polygon.id, 'ETH', ALL)).toBe('USDC');
    expect(resolveWalletDepositSymbol(base.id, 'FUSE', ALL)).toBe('USDC');
    expect(resolveWalletDepositSymbol(fuse.id, 'ETH', ALL)).toBe('USDC');
    expect(resolveWalletDepositSymbol(arbitrum.id, 'cbBTC', ALL)).toBe('USDC');
  });

  it("picks the chain's first currency when none was chosen yet", () => {
    expect(resolveWalletDepositSymbol(mainnet.id, undefined, ALL)).toBe('USDC');
  });

  it('has nothing to offer for an unsupported chain', () => {
    expect(resolveWalletDepositSymbol(999_999, 'USDC', ALL)).toBeUndefined();
  });
});

describe('getDefaultWalletDepositSelection', () => {
  /**
   * Base: it carries nearly every currency on offer, at a fraction of
   * Ethereum's gas. The address there is our own: the Safe.
   */
  it('opens on USDC over Base', () => {
    expect(getDefaultWalletDepositSelection()).toEqual({ chainId: base.id, symbol: 'USDC' });
  });

  it('offers USDC on the chain it opens on', () => {
    const { chainId, symbol } = getDefaultWalletDepositSelection();
    expect(symbolsOf(getWalletDepositTokens(chainId, ALL))).toContain(symbol);
  });
});

describe('getAllWalletDepositTokens', () => {
  it('lists every currency some chain accepts, once', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(ALL));
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  // The design's order: stablecoins, then ETH first among the crypto, Mark's
  // list after it, and the wrapped natives last.
  it('lists them in the order "Select token" shows them', () => {
    expect(symbolsOf(getAllWalletDepositTokens(ALL))).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'ETH',
      'FUSE',
      'cbBTC',
      'cbZEC',
      'AAVE',
      'SOL',
      'WETH',
      'WFUSE',
    ]);
  });

  // The tokens retired with the Base-only collateral list.
  it('leaves out the retired tokens', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(ALL));
    ['PAXG', 'SLVx', 'ZEC', 'NEAR', 'WLD', 'ARB', 'OP', 'UNI', 'ENA', 'WBTC'].forEach(symbol =>
      expect(symbols).not.toContain(symbol),
    );
  });

  // The list decides what is on offer; rhino.fi only decides where.
  it('offers no token off the list, whatever rhino.fi takes', () => {
    const withOp: RhinoAssetsState = {
      status: 'ready',
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain =>
          chain.chain === 'OPTIMISM'
            ? {
                ...chain,
                tokens: [...chain.tokens, rhinoToken('OP', [rhinoRoute('WALLET', 'OP')])],
              }
            : chain,
        ),
      },
    };
    expect(symbolsOf(getAllWalletDepositTokens({ ...ALL, rhino: withOp }))).not.toContain('OP');
  });

  it('carries the full name each row shows under the ticker', () => {
    const names = Object.fromEntries(
      getAllWalletDepositTokens(ALL).map(token => [token.symbol, token.name]),
    );
    expect(names).toMatchObject({
      USDC: 'USD Coin',
      cbZEC: 'Coinbase Wrapped ZEC',
      cbBTC: 'Coinbase Wrapped BTC',
      WFUSE: 'Wrapped FUSE',
    });
  });
});

describe('groupWalletDepositTokens', () => {
  it('puts each currency under its heading, in the design’s order', () => {
    const groups = groupWalletDepositTokens(getAllWalletDepositTokens(WIREX));

    // Gold and silver have no row: rhino.fi takes neither, and neither is on Base.
    expect(groups.map(group => group.label)).toEqual(['Stablecoins', 'Crypto']);
    expect(symbolsOf(groups[0].tokens)).toEqual(['USDC', 'USDT', 'EURC']);
    expect(groups[1].tokens[0].symbol).toBe('ETH');
  });

  it('leaves out a group with nothing in it', () => {
    const btc = getAllWalletDepositTokens(ALL).filter(token =>
      matchesWalletDepositSearch(token, 'btc'),
    );
    expect(groupWalletDepositTokens(btc).map(group => group.label)).toEqual(['Crypto']);
  });
});

describe('matchesWalletDepositSearch', () => {
  const search = (query: string) =>
    symbolsOf(
      getAllWalletDepositTokens(ALL).filter(token => matchesWalletDepositSearch(token, query)),
    );

  it('matches a ticker, whatever the case', () => {
    expect(search('btc')).toEqual(['cbBTC']);
    expect(search('USDC')).toEqual(['USDC']);
  });

  it('matches a name', () => {
    expect(search('bitcoin')).toEqual(['cbBTC']);
    expect(search('solana')).toEqual(['SOL']);
  });

  it('matches what a person might type instead', () => {
    expect(search('coinbase')).toEqual(['cbBTC', 'cbZEC']);
    expect(search('zcash')).toEqual(['cbZEC']);
    expect(search('ethereum')).toEqual(['ETH']);
  });

  it('lists everything for an empty query, and nothing for a token not offered', () => {
    expect(search('  ')).toHaveLength(getAllWalletDepositTokens(ALL).length);
    expect(search('doge')).toEqual([]);
  });
});

describe('getWalletDepositNetworksForToken', () => {
  it('only offers the chains that carry the currency', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('ETH', ALL))).toEqual([
      mainnet.id,
      base.id,
      arbitrum.id,
      bsc.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('FUSE', ALL))).toEqual([fuse.id]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('WFUSE', ALL))).toEqual([fuse.id]);
  });

  // Base is our own whatever rhino.fi lists; the rest go with its routes.
  it('offers a currency off Base only on the chains rhino.fi takes it on', () => {
    expect(
      chainIdsOf(getWalletDepositNetworksForToken('ETH', { ...ALL, rhino: withoutArbitrumEth() })),
    ).toEqual([mainnet.id, base.id, bsc.id]);
  });

  it('offers a currency rhino.fi takes nowhere on Base alone, as the Safe', () => {
    ['WETH', 'cbBTC', 'cbZEC', 'AAVE', 'SOL'].forEach(symbol =>
      expect(chainIdsOf(getWalletDepositNetworksForToken(symbol, ALL))).toEqual([base.id]),
    );
  });

  it('offers every network a stablecoin is on', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', ALL))).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      bsc.id,
      fuse.id,
    ]);
    // USDT: rhino.fi's everywhere it takes it; the Safe on Base.
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDT', ALL))).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      bsc.id,
      fuse.id,
    ]);
  });

  // Off Fuse, a Wirex cardholder's dollars take rhino.fi's wallet route, like
  // everyone's, and their USDT on Base our own pipeline's.
  it("offers a Wirex cardholder's stablecoins on the same chains as anyone's", () => {
    ['USDC', 'USDT'].forEach(symbol =>
      expect(chainIdsOf(getWalletDepositNetworksForToken(symbol, WIREX))).toEqual(
        chainIdsOf(getWalletDepositNetworksForToken(symbol, RAIN)),
      ),
    );
  });

  it('offers only Base and Fuse until rhino.fi’s routes are in', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', { hasNewTokens: true }))).toEqual([
      base.id,
      fuse.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('ETH', { hasNewTokens: true }))).toEqual([
      base.id,
    ]);
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDT', { hasNewTokens: true }))).toEqual([
      base.id,
      fuse.id,
    ]);
  });

  it('offers every chain when no currency is chosen', () => {
    expect(getWalletDepositNetworksForToken(undefined, ALL)).toEqual(getWalletDepositNetworks(ALL));
  });
});

describe('resolveWalletDepositChain', () => {
  it('opens every currency Base carries on Base', () => {
    expect(resolveWalletDepositChain('USDC', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('USDT', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('ETH', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('WETH', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('EURC', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('cbBTC', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('cbZEC', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('AAVE', undefined, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('SOL', undefined, ALL)).toBe(base.id);
  });

  // USDC on Base is the default, and Base is our own whatever rhino.fi lists.
  it('opens USDC on Base even when rhino.fi lists no route there', () => {
    const noBase: RhinoAssetsState = {
      status: 'ready',
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BASE'),
      },
    };
    expect(resolveWalletDepositChain('USDC', undefined, { ...ALL, rhino: noBase })).toBe(base.id);
  });

  it('opens the Fuse currencies on Fuse, the only chain carrying them', () => {
    expect(resolveWalletDepositChain('FUSE', undefined, ALL)).toBe(fuse.id);
    expect(resolveWalletDepositChain('WFUSE', undefined, ALL)).toBe(fuse.id);
  });

  // Changing only the currency from the address screen should not move the chain.
  it('keeps the current chain when it carries the currency', () => {
    expect(resolveWalletDepositChain('USDC', polygon.id, ALL)).toBe(polygon.id);
    expect(resolveWalletDepositChain('ETH', mainnet.id, ALL)).toBe(mainnet.id);
    expect(resolveWalletDepositChain('ETH', bsc.id, ALL)).toBe(bsc.id);
  });

  it('moves to Base when the current chain does not carry the currency', () => {
    expect(resolveWalletDepositChain('ETH', polygon.id, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('USDC', 999_999, ALL)).toBe(base.id);
    expect(resolveWalletDepositChain('cbBTC', arbitrum.id, ALL)).toBe(base.id);
    expect(
      resolveWalletDepositChain('ETH', arbitrum.id, { ...ALL, rhino: withoutArbitrumEth() }),
    ).toBe(base.id);
  });
});

/**
 * The new deposit tokens are rolled out to the internal team first
 * (`useDepositTokensAccess`). Until someone is given them, the screen offers
 * what every user is offered (`releasedOn`), where rhino.fi or our own
 * pipeline can take it.
 */
describe('without the new deposit tokens', () => {
  it('offers only the currencies everyone had', () => {
    expect(symbolsOf(getAllWalletDepositTokens(BASIC))).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'ETH',
      'FUSE',
      'WETH',
      'WFUSE',
    ]);
    expect(
      symbolsOf(getAllWalletDepositTokens({ provider: CardProvider.WIREX, rhino: READY })),
    ).toEqual(['USDC', 'USDT', 'EURC', 'ETH', 'FUSE', 'WETH', 'WFUSE']);
  });

  it('offers each on the chains it was offered on, and none on Optimism', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', BASIC))).toEqual([
      mainnet.id,
      polygon.id,
      base.id,
      arbitrum.id,
      bsc.id,
      fuse.id,
    ]);
    // ETH is everyone's on Ethereum alone, through rhino.fi.
    expect(chainIdsOf(getWalletDepositNetworksForToken('ETH', BASIC))).toEqual([mainnet.id]);
    // rhino.fi takes no WETH, so it is the Safe on Base alone.
    expect(chainIdsOf(getWalletDepositNetworksForToken('WETH', BASIC))).toEqual([base.id]);
    expect(chainIdsOf(getWalletDepositNetworks(BASIC))).not.toContain(optimism.id);
    expect(getWalletDepositTokens(optimism.id, BASIC)).toEqual([]);
  });

  it('lists per chain what rhino.fi takes of what the screen listed before', () => {
    expect(symbolsOf(getWalletDepositTokens(base.id, BASIC))).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'WETH',
    ]);
    expect(symbolsOf(getWalletDepositTokens(mainnet.id, BASIC))).toEqual([
      'USDC',
      'USDT',
      'EURC',
      'ETH',
    ]);
    expect(symbolsOf(getWalletDepositTokens(polygon.id, BASIC))).toEqual(['USDC', 'USDT']);
    expect(symbolsOf(getWalletDepositTokens(fuse.id, BASIC))).toEqual([
      'USDC',
      'USDT',
      'FUSE',
      'WFUSE',
    ]);
  });

  it('moves a currency off a chain it is not offered on yet', () => {
    expect(resolveWalletDepositSymbol(optimism.id, 'USDC', BASIC)).toBeUndefined();
    expect(resolveWalletDepositChain('ETH', arbitrum.id, BASIC)).toBe(mainnet.id);
  });

  it('still opens on USDC over Base', () => {
    expect(getDefaultWalletDepositSelection()).toEqual({ chainId: base.id, symbol: 'USDC' });
  });
});

/**
 * EURC is offered to everyone: on Base as the Safe, and on Ethereum through
 * rhino.fi's wallet route, which pays it to the same Safe on Base.
 */
describe('EURC', () => {
  it('is offered to everyone, card or none', () => {
    [ALL, RAIN, WIREX, BASIC].forEach(viewer =>
      expect(symbolsOf(getAllWalletDepositTokens(viewer))).toContain('EURC'),
    );
  });

  it('follows the other stablecoins in "Select token"', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(WIREX));
    expect(symbols.slice(0, 4)).toEqual(['USDC', 'USDT', 'EURC', 'ETH']);
  });

  // Circle's EURC on Ethereum, which rhino.fi pays out as EURC on Base.
  it('is offered on Ethereum through rhino.fi, and on Base as the Safe', () => {
    expect(symbolsOf(getWalletDepositTokens(base.id, WIREX))).toContain('EURC');
    expect(getWalletDepositRow(base.id, 'EURC', WIREX)).toEqual({ kind: 'own' });
    expect(symbolsOf(getWalletDepositTokens(mainnet.id, WIREX))).toContain('EURC');
    expect(chainIdsOf(getWalletDepositNetworksForToken('EURC', WIREX))).toEqual([
      mainnet.id,
      base.id,
    ]);
    expect(getWalletDepositRow(mainnet.id, 'EURC', WIREX)).toMatchObject({
      kind: 'rhino',
      selection: { chain: 'ETHEREUM', tokenSymbol: 'EURC', destinationType: 'WALLET' },
    });
    expect(
      WALLET_DEPOSIT_TOKENS.find(token => token.symbol === 'EURC')?.contracts[mainnet.id],
    ).toBe('0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c');
  });

  // Not Arc, pending a product decision, nor Optimism, though rhino.fi lists both.
  // Nor under "More networks", which offers Bitcoin alone.
  it('is not offered on Optimism, Arc or Solana', () => {
    expect(chainIdsOf(getWalletDepositNetworksForToken('EURC', WIREX))).not.toContain(optimism.id);
    expect(getWalletDepositExtraNetworks('EURC', WIREX)).toEqual([]);
  });

  it('is not offered on Ethereum without rhino.fi', () => {
    const noEthereumEurc: RhinoAssetsState = {
      status: 'ready',
      assets: {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain =>
          chain.chain === 'ETHEREUM'
            ? { ...chain, tokens: chain.tokens.filter(token => token.symbol !== 'EURC') }
            : chain,
        ),
      },
    };
    expect(getWalletDepositRow(mainnet.id, 'EURC', { ...WIREX, rhino: noEthereumEurc })).toEqual({
      kind: 'none',
    });
  });

  it('opens on Base, whatever chain was showing', () => {
    expect(resolveWalletDepositChain('EURC', undefined, WIREX)).toBe(base.id);
    expect(resolveWalletDepositChain('EURC', fuse.id, WIREX)).toBe(base.id);
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

describe('getWalletRhinoSelection', () => {
  it('sends a row through rhino.fi to the Safe on Base, Base itself included', () => {
    ['USDC', 'ETH', 'EURC', 'WBTC'].forEach(symbol =>
      expect(getWalletRhinoSelection(RHINO_ASSETS, mainnet.id, symbol)).toEqual({
        chain: 'ETHEREUM',
        chainId: mainnet.id,
        tokenSymbol: symbol,
        destinationType: 'WALLET',
      }),
    );
    expect(getWalletRhinoSelection(RHINO_ASSETS, base.id, 'USDC')?.chain).toBe('BASE');
  });

  it('has none for Fuse, nor where rhino.fi has no route', () => {
    expect(getWalletRhinoSelection(RHINO_ASSETS, fuse.id, 'USDC')).toBeUndefined();
    expect(getWalletRhinoSelection(RHINO_ASSETS, polygon.id, 'WBTC')).toBeUndefined();
    expect(getWalletRhinoSelection(RHINO_ASSETS, base.id, 'cbBTC')).toBeUndefined();
    // The backend lists no wallet route for USDT sent on Base.
    expect(getWalletRhinoSelection(RHINO_ASSETS, base.id, 'USDT')).toBeUndefined();
  });

  it('takes USDT off Base through the wallet route', () => {
    expect(getWalletRhinoSelection(RHINO_ASSETS, arbitrum.id, 'USDT')).toEqual({
      chain: 'ARBITRUM',
      chainId: arbitrum.id,
      tokenSymbol: 'USDT',
      destinationType: 'WALLET',
    });
  });

  it('has none while rhino.fi is not offered', () => {
    expect(getWalletRhinoSelection(undefined, mainnet.id, 'USDC')).toBeUndefined();
    expect(
      getWalletRhinoSelection({ ...RHINO_ASSETS, enabled: false }, mainnet.id, 'USDC'),
    ).toBeUndefined();
  });
});

describe('getWalletDepositRow', () => {
  const LOADING = { hasNewTokens: true, rhino: { status: 'loading' } as RhinoAssetsState };
  const UNAVAILABLE = {
    hasNewTokens: true,
    rhino: { status: 'unavailable' } as RhinoAssetsState,
  };
  const withAssets = (assets: RhinoDepositAssetsResponse, provider?: CardProvider) => ({
    provider,
    hasNewTokens: true,
    rhino: { status: 'ready', assets } as RhinoAssetsState,
  });

  it('keeps Fuse our own, whatever the state of rhino.fi', () => {
    [ALL, LOADING, UNAVAILABLE, WIREX].forEach(viewer => {
      expect(getWalletDepositRow(fuse.id, 'USDC', viewer)).toEqual({ kind: 'own' });
      expect(getWalletDepositRow(fuse.id, 'FUSE', viewer)).toEqual({ kind: 'own' });
    });
  });

  // rhino.fi would only pay a deposit sent on Base back to Base.
  it('keeps Base our own, whatever rhino.fi lists there', () => {
    [ALL, WIREX].forEach(viewer =>
      ['USDC', 'EURC', 'ETH', 'WETH', 'cbBTC'].forEach(symbol =>
        expect(getWalletDepositRow(base.id, symbol, viewer)).toEqual({ kind: 'own' }),
      ),
    );
    const noBase = withAssets({
      ...RHINO_ASSETS,
      chains: RHINO_ASSETS.chains.filter(chain => chain.chain !== 'BASE'),
    });
    expect(getWalletDepositRow(base.id, 'USDC', noBase)).toEqual({ kind: 'own' });
  });

  it('serves every row off Base and Fuse through rhino.fi', () => {
    expect(getWalletDepositRow(bsc.id, 'ETH', ALL)).toMatchObject({ kind: 'rhino' });
    // A Wirex cardholder's USDC goes to the Safe on Base like everyone's.
    [mainnet.id, arbitrum.id].forEach(chainId =>
      expect(getWalletDepositRow(chainId, 'USDC', WIREX)).toMatchObject({
        kind: 'rhino',
        selection: { destinationType: 'WALLET' },
      }),
    );
    expect(getWalletDepositRow(mainnet.id, 'EURC', WIREX)).toMatchObject({
      kind: 'rhino',
      selection: { destinationType: 'WALLET' },
    });
  });

  // Never the Safe, and never a minted address, on a row rhino.fi does not take.
  it('offers no row rhino.fi does not take a currency it takes elsewhere from', () => {
    expect(
      getWalletDepositRow(arbitrum.id, 'ETH', { ...ALL, rhino: withoutArbitrumEth() }),
    ).toEqual({ kind: 'none' });
  });

  it('shows the Safe on Base alone for a currency rhino.fi takes nowhere', () => {
    expect(getWalletDepositRow(base.id, 'WETH', ALL)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(mainnet.id, 'WETH', ALL)).toEqual({ kind: 'none' });
    expect(getWalletDepositRow(base.id, 'cbBTC', ALL)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(mainnet.id, 'cbBTC', ALL)).toEqual({ kind: 'none' });
  });

  it('falls to the Safe on Base for a currency none of whose rows rhino.fi takes', () => {
    const noEurc = withAssets(
      {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain => ({
          ...chain,
          tokens: chain.tokens.filter(t => t.symbol !== 'EURC'),
        })),
      },
      CardProvider.WIREX,
    );
    expect(getWalletDepositRow(base.id, 'EURC', noEurc)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(mainnet.id, 'EURC', noEurc)).toEqual({ kind: 'none' });
  });

  // Their dollars match the wallet route now, so the card route makes no difference.
  it('serves a Wirex cardholder’s USDC without rhino.fi’s card route', () => {
    const noCardRoutes = withAssets(
      {
        ...RHINO_ASSETS,
        chains: RHINO_ASSETS.chains.map(chain => ({
          ...chain,
          tokens: chain.tokens.map(t => ({
            ...t,
            routes: t.routes.filter(route => route.destinationType !== 'RAIN_CARD'),
          })),
        })),
      },
      CardProvider.WIREX,
    );
    expect(getWalletDepositRow(arbitrum.id, 'USDC', noCardRoutes)).toMatchObject({
      kind: 'rhino',
    });
    expect(getWalletDepositRow(fuse.id, 'USDC', noCardRoutes)).toEqual({ kind: 'own' });
  });

  // USDT on Base and Fuse is our own, whatever rhino.fi lists and whether or not
  // it has answered.
  it('keeps USDT on Base and Fuse our own', () => {
    const withBaseUsdtRoutes = withAssets(RHINO_ASSETS_WITH_BASE_USDT_ROUTES);
    [ALL, WIREX, LOADING, UNAVAILABLE, withBaseUsdtRoutes].forEach(viewer =>
      [base.id, fuse.id].forEach(chainId =>
        expect(getWalletDepositRow(chainId, 'USDT', viewer)).toEqual({ kind: 'own' }),
      ),
    );
  });

  // Everywhere else rhino.fi's wallet route, which pays the Safe on Base as USDC.
  it('serves USDT off Base and Fuse through rhino.fi', () => {
    [ALL, WIREX].forEach(viewer =>
      [mainnet.id, polygon.id, arbitrum.id, bsc.id].forEach(chainId =>
        expect(getWalletDepositRow(chainId, 'USDT', viewer)).toMatchObject({
          kind: 'rhino',
          selection: { chainId, tokenSymbol: 'USDT', destinationType: 'WALLET' },
        }),
      ),
    );
    expect(getWalletDepositRow(polygon.id, 'USDT', LOADING)).toEqual({ kind: 'loading' });
    expect(getWalletDepositRow(polygon.id, 'USDT', UNAVAILABLE)).toEqual({ kind: 'unavailable' });
  });

  it('decides no other row until rhino.fi’s routes are in, nor when they cannot be had', () => {
    [
      [mainnet.id, 'USDC'],
      [mainnet.id, 'EURC'],
      [arbitrum.id, 'ETH'],
      [polygon.id, 'USDC'],
    ].forEach(([chainId, symbol]) => {
      expect(getWalletDepositRow(chainId as number, symbol as string, LOADING)).toEqual({
        kind: 'loading',
      });
      expect(getWalletDepositRow(chainId as number, symbol as string, UNAVAILABLE)).toEqual({
        kind: 'unavailable',
      });
    });
    // Leaving the routes out counts as still loading.
    expect(getWalletDepositRow(mainnet.id, 'USDC', { hasNewTokens: true })).toEqual({
      kind: 'loading',
    });
    // Base is our own, and waits for nothing.
    ['USDC', 'ETH', 'WETH', 'cbBTC'].forEach(symbol => {
      expect(getWalletDepositRow(base.id, symbol, LOADING)).toEqual({ kind: 'own' });
      expect(getWalletDepositRow(base.id, symbol, UNAVAILABLE)).toEqual({ kind: 'own' });
    });
  });

  it('has no row for a pairing the person is not offered', () => {
    expect(getWalletDepositRow(base.id, 'FUSE', ALL)).toEqual({ kind: 'none' });
    expect(getWalletDepositRow(base.id, 'cbBTC', BASIC)).toEqual({ kind: 'none' });
    expect(getWalletDepositRow(base.id, 'DOGE', ALL)).toEqual({ kind: 'none' });
  });
});

describe('getWalletDepositNetworksNotice', () => {
  it('waits, or offers a retry, for a currency with rows off Fuse', () => {
    expect(
      getWalletDepositNetworksNotice('USDC', { rhino: { status: 'loading' } as RhinoAssetsState }),
    ).toBe('loading');
    expect(
      getWalletDepositNetworksNotice('WETH', {
        rhino: { status: 'unavailable' } as RhinoAssetsState,
      }),
    ).toBe('unavailable');
  });

  it('says nothing once the routes are in, nor for a currency only Fuse takes', () => {
    expect(getWalletDepositNetworksNotice('USDC', ALL)).toBeUndefined();
    expect(
      getWalletDepositNetworksNotice('FUSE', { rhino: { status: 'loading' } as RhinoAssetsState }),
    ).toBeUndefined();
  });
});

/**
 * "More networks": the chains rhino.fi lists that the app has no row for, each
 * with only what rhino.fi takes into the wallet there.
 */
describe('getWalletDepositExtraNetworks', () => {
  // Product decision, 2026-11-10: "More networks" offers Bitcoin alone. The
  // backend still lists Tron, Solana, Avalanche and Arc, with wallet routes.
  it('offers none of the other chains the app has no row for', () => {
    ['USDC', 'USDT', 'ETH', 'EURC'].forEach(symbol =>
      expect(getWalletDepositExtraNetworks(symbol, ALL)).toEqual([]),
    );
  });

  it('has none for a currency off the list, nor before the routes are in', () => {
    expect(getWalletDepositExtraNetworks('DOGE', ALL)).toEqual([]);
    expect(getWalletDepositExtraNetworks('USDC', { rhino: { status: 'loading' } })).toEqual([]);
    expect(getWalletDepositExtraNetworks('USDC', { rhino: { status: 'unavailable' } })).toEqual([]);
  });
});

describe('getWalletDepositExtraRow', () => {
  it('is the rhino.fi address for Bitcoin, for native BTC', () => {
    expect(
      getWalletDepositExtraRow('BITCOIN', 'BTC', {
        hasNewTokens: true,
        rhino: { status: 'ready', assets: RHINO_ASSETS_WITH_BITCOIN },
      }),
    ).toEqual({
      kind: 'rhino',
      selection: { chain: 'BITCOIN', tokenSymbol: 'BTC', destinationType: 'WALLET' },
    });
  });

  // A screen left on one of them (an address from before) moves off it.
  it('has none on a chain no longer offered', () => {
    expect(getWalletDepositExtraRow('SOLANA', 'USDC', ALL)).toEqual({ kind: 'none' });
    expect(getWalletDepositExtraRow('AVALANCHE', 'ETH', ALL)).toEqual({ kind: 'none' });
    expect(getWalletDepositExtraRow('TRON', 'USDT', ALL)).toEqual({ kind: 'none' });
  });

  it('waits for the routes', () => {
    expect(getWalletDepositExtraRow('BITCOIN', 'BTC', { rhino: { status: 'loading' } })).toEqual({
      kind: 'loading',
    });
    expect(
      getWalletDepositExtraRow('BITCOIN', 'BTC', { rhino: { status: 'unavailable' } }),
    ).toEqual({ kind: 'unavailable' });
  });
});

describe('native BTC', () => {
  /** rhino.fi's routes with Bitcoin switched on for this deployment. */
  const WITH_BITCOIN: RhinoAssetsState = { status: 'ready', assets: RHINO_ASSETS_WITH_BITCOIN };
  const NEW_TOKENS = { hasNewTokens: true, rhino: WITH_BITCOIN };

  it('is listed once rhino.fi takes it on Bitcoin, just before cbBTC', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(NEW_TOKENS));
    expect(symbols).toContain('BTC');
    expect(symbols.indexOf('BTC')).toBe(symbols.indexOf('cbBTC') - 1);
    // Not while rhino.fi does not list it there: Bitcoin off, or routes not in.
    expect(symbolsOf(getAllWalletDepositTokens(ALL))).not.toContain('BTC');
    expect(
      symbolsOf(getAllWalletDepositTokens({ hasNewTokens: true, rhino: { status: 'loading' } })),
    ).not.toContain('BTC');
  });

  // A new deposit token on every chain it has: the internal team in production
  // until it is rolled out, everyone on qa/preview builds.
  it('is offered only to those given the new deposit tokens', () => {
    const basic = { rhino: WITH_BITCOIN };
    expect(symbolsOf(getAllWalletDepositTokens(basic))).not.toContain('BTC');
    expect(getWalletDepositExtraNetworks('BTC', basic)).toEqual([]);
    expect(getWalletDepositExtraRow('BITCOIN', 'BTC', basic)).toEqual({ kind: 'none' });
  });

  it('has no row of the list’s own, only Bitcoin under "More networks"', () => {
    expect(getWalletDepositNetworksForToken('BTC', NEW_TOKENS)).toEqual([]);
    expect(getWalletDepositExtraNetworks('BTC', NEW_TOKENS).map(chain => chain.chain)).toEqual([
      'BITCOIN',
    ]);
    // On no chain the list has: never a stray row on Base, where nothing is.
    expect(getWalletDepositRow(base.id, 'BTC', NEW_TOKENS)).toEqual({ kind: 'none' });
  });

  it('serves Bitcoin with its rhino.fi address, which has no EVM chain id', () => {
    expect(getWalletDepositExtraRow('BITCOIN', 'BTC', NEW_TOKENS)).toEqual({
      kind: 'rhino',
      selection: { chain: 'BITCOIN', tokenSymbol: 'BTC', destinationType: 'WALLET' },
    });
  });

  it('opens on Bitcoin when picked, and keeps a "More networks" chain only where it fits', () => {
    expect(resolveWalletDepositExtraChain('BTC', undefined, NEW_TOKENS)).toBe('BITCOIN');
    // From Tron, which takes no BTC.
    expect(resolveWalletDepositExtraChain('BTC', 'TRON', NEW_TOKENS)).toBe('BITCOIN');
    // A currency with rows of its own goes back to them, as before.
    expect(resolveWalletDepositExtraChain('USDC', undefined, NEW_TOKENS)).toBeUndefined();
    expect(resolveWalletDepositExtraChain('cbBTC', 'BITCOIN', NEW_TOKENS)).toBeUndefined();
    // Tron is no longer offered, so USDT goes back to its own rows too.
    expect(resolveWalletDepositExtraChain('USDT', 'TRON', NEW_TOKENS)).toBeUndefined();
    // Nowhere to open while Bitcoin is off.
    expect(resolveWalletDepositExtraChain('BTC', undefined, ALL)).toBeUndefined();
  });

  it('is drawn with its own mark', () => {
    expect(getWalletDepositTokenIcon('BTC')).toBe('images/btc.png');
  });
});

/**
 * The backend answers `enabled: false` when it has no rhino.fi key (or has no
 * such endpoint): every row is then our own pipeline's, as before rhino.fi,
 * rather than a retry that can never succeed.
 */
describe('with rhino.fi off', () => {
  const DISABLED: RhinoAssetsState = { status: 'disabled' };
  const OFF = { hasNewTokens: true, rhino: DISABLED };
  const WIREX_OFF = { ...OFF, provider: CardProvider.WIREX };

  // Our pipeline bridges dollars to the Safe on Base from Ethereum, Polygon,
  // Arbitrum and BNB Chain; it does not watch Optimism.
  it('offers the dollar stablecoins wherever our own pipeline takes them', () => {
    ['USDC', 'USDT'].forEach(symbol =>
      expect(chainIdsOf(getWalletDepositNetworksForToken(symbol, OFF))).toEqual([
        mainnet.id,
        polygon.id,
        base.id,
        arbitrum.id,
        bsc.id,
        fuse.id,
      ]),
    );
  });

  // ETH included, to our wallet address there; EURC loses Ethereum, rhino.fi's.
  it('keeps Base our own for every currency with a Base contract', () => {
    ['EURC', 'ETH', 'WETH', 'cbBTC', 'cbZEC', 'AAVE', 'SOL'].forEach(symbol =>
      expect(chainIdsOf(getWalletDepositNetworksForToken(symbol, OFF))).toEqual([base.id]),
    );
    ['FUSE', 'WFUSE'].forEach(symbol =>
      expect(chainIdsOf(getWalletDepositNetworksForToken(symbol, OFF))).toEqual([fuse.id]),
    );
  });

  it('serves every row it offers as our own, with no retry', () => {
    expect(getWalletDepositRow(polygon.id, 'USDC', OFF)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(base.id, 'ETH', OFF)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(base.id, 'cbBTC', OFF)).toEqual({ kind: 'own' });
    expect(getWalletDepositRow(optimism.id, 'USDC', OFF)).toEqual({ kind: 'none' });
    expect(getWalletDepositRow(mainnet.id, 'ETH', OFF)).toEqual({ kind: 'none' });
    ['USDC', 'ETH', 'cbBTC', 'BTC'].forEach(symbol =>
      expect(getWalletDepositNetworksNotice(symbol, OFF)).toBeUndefined(),
    );
  });

  it('mints a wallet address for dollars off Base, and shows the Safe on Base', () => {
    [mainnet.id, polygon.id, arbitrum.id, bsc.id].forEach(chainId =>
      expect(getWalletOwnAddress(chainId, 'USDC', undefined, { rhinoOff: true })).toEqual({
        kind: 'session',
        destinationType: 'WALLET',
      }),
    );
    // A Wirex cardholder's too: their card spends from the Safe on Base.
    expect(getWalletOwnAddress(polygon.id, 'USDT', CardProvider.WIREX, { rhinoOff: true })).toEqual(
      { kind: 'session', destinationType: 'WALLET' },
    );
    expect(getWalletOwnAddress(base.id, 'USDC', undefined, { rhinoOff: true })).toEqual({
      kind: 'safe',
    });
    // Nothing that would stay on the chain it was sent on.
    expect(getWalletOwnAddress(optimism.id, 'USDC', undefined, { rhinoOff: true })).toBeUndefined();
    expect(getWalletOwnAddress(mainnet.id, 'ETH', undefined, { rhinoOff: true })).toBeUndefined();
    // And nothing off Base while rhino.fi is on.
    expect(getWalletOwnAddress(polygon.id, 'USDC', undefined)).toBeUndefined();
  });

  it('keeps Fuse as it always was', () => {
    expect(getWalletOwnAddress(fuse.id, 'USDC', CardProvider.WIREX, { rhinoOff: true })).toEqual({
      kind: 'session',
      destinationType: 'RAIN_CARD',
    });
    expect(getWalletOwnAddress(fuse.id, 'USDC', undefined, { rhinoOff: true })).toEqual({
      kind: 'safe',
    });
    expect(chainIdsOf(getWalletDepositNetworksForToken('USDC', WIREX_OFF))).toContain(fuse.id);
  });

  it('lists every currency some row of ours takes, and none only rhino.fi carries', () => {
    const symbols = symbolsOf(getAllWalletDepositTokens(OFF));
    expect(symbols).toEqual(expect.arrayContaining(['USDC', 'USDT', 'ETH', 'cbBTC', 'FUSE']));
    expect(symbols).not.toContain('BTC');
  });

  it('offers no "More networks", and moves off a chain from there', () => {
    expect(getWalletDepositExtraNetworks('USDC', OFF)).toEqual([]);
    expect(getWalletDepositExtraRow('TRON', 'USDT', OFF)).toEqual({ kind: 'none' });
    expect(getWalletDepositExtraRow('BITCOIN', 'BTC', OFF)).toEqual({ kind: 'none' });
    expect(resolveWalletDepositExtraChain('BTC', undefined, OFF)).toBeUndefined();
  });

  it('opens on USDC over Base, as it does with rhino.fi on', () => {
    expect(resolveWalletDepositChain('USDC', undefined, OFF)).toBe(base.id);
    expect(resolveWalletDepositChain('ETH', mainnet.id, OFF)).toBe(base.id);
  });
});
