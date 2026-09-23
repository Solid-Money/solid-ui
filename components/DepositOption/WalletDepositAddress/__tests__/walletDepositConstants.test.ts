import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import {
  getAllWalletDepositTokens,
  getDefaultWalletDepositSelection,
  getWalletDepositMinimum,
  getWalletDepositNetworks,
  getWalletDepositNetworksForToken,
  getWalletDepositTokenIcon,
  getWalletDepositTokens,
  resolveWalletDepositChain,
  resolveWalletDepositMinimum,
  resolveWalletDepositSymbol,
  usesDirectDepositAddress,
} from '@/components/DepositOption/WalletDepositAddress/constants';
import { DepositAsset } from '@/lib/types';

// The module resolves icons through the asset barrel; what is under test is
// which chains and currencies are offered and what each pairing's floor is.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));

describe('getWalletDepositMinimum', () => {
  it('asks for more on Ethereum than on the chains its deposits are cheap to move on', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'USDC')).toBe(10);
    expect(getWalletDepositMinimum(base.id, 'USDC')).toBe(1);
    expect(getWalletDepositMinimum(arbitrum.id, 'USDT')).toBe(1);
  });

  // A floor is a number of tokens, so an asset that is not worth ~$1 a unit needs
  // its own — 10 ETH would be an absurd minimum, 1 FUSE a meaningless one.
  it('overrides the chain floor for currencies that are not worth ~$1 a unit', () => {
    expect(getWalletDepositMinimum(mainnet.id, 'ETH')).toBe(0.005);
    expect(getWalletDepositMinimum(mainnet.id, 'WETH')).toBe(0.005);
    expect(getWalletDepositMinimum(fuse.id, 'FUSE')).toBe(500);
  });

  it('falls back to a floor rather than none for an unlisted chain', () => {
    expect(getWalletDepositMinimum(999_999, 'USDC')).toBe(1);
  });
});

describe('getWalletDepositTokens', () => {
  it('lists the currencies the chain actually carries', () => {
    expect(getWalletDepositTokens(mainnet.id).map(token => token.symbol)).toEqual([
      'USDC',
      'USDT',
      'ETH',
      'WETH',
    ]);
    // Base is USDC only — USDT there is deliberately not offered.
    expect(getWalletDepositTokens(base.id).map(token => token.symbol)).toEqual(['USDC']);
  });

  it('returns nothing for a chain that is not supported', () => {
    expect(getWalletDepositTokens(999_999)).toEqual([]);
  });
});

describe('getWalletDepositTokenIcon', () => {
  // Most chains' USDC entry carries no icon of its own, which used to leave the
  // currency pill blank everywhere but Ethereum.
  it('falls back to the currency icon when the chain entry carries none', () => {
    expect(getWalletDepositTokenIcon(polygon.id, 'USDC')).toBe('images/usdc-4x.png');
  });

  it('prefers the icon on the chain entry when there is one', () => {
    expect(getWalletDepositTokenIcon(mainnet.id, 'USDC')).not.toBe('images/usdc-4x.png');
  });
});

describe('getWalletDepositNetworks', () => {
  it('offers only chains with a currency to deposit, in display order', () => {
    const networks = getWalletDepositNetworks();

    expect(networks.length).toBeGreaterThan(0);
    expect(networks.every(network => getWalletDepositTokens(network.chainId).length > 0)).toBe(
      true,
    );
    expect(networks[0].chainId).toBe(mainnet.id);
  });
});

/**
 * Which address the screen hands out. A minted address is watched by the deposit
 * pipeline; the Safe is not. Getting this wrong either strands a transfer or
 * makes the screen promise a detection that can never happen.
 */
describe('usesDirectDepositAddress', () => {
  it('mints an address for the stablecoins the pipeline has a route for', () => {
    expect(usesDirectDepositAddress('USDC')).toBe(true);
    expect(usesDirectDepositAddress('USDT')).toBe(true);
  });

  // These land in the Safe and stay as the token that was sent, so the Safe
  // address is the right answer rather than a fallback.
  it('keeps the Safe for the currencies with no route', () => {
    expect(usesDirectDepositAddress('ETH')).toBe(false);
    expect(usesDirectDepositAddress('WETH')).toBe(false);
    expect(usesDirectDepositAddress('FUSE')).toBe(false);
    expect(usesDirectDepositAddress('WFUSE')).toBe(false);
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
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', assets)).toBe(25);
  });

  it('falls back when the pipeline has not answered', () => {
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', undefined)).toBe(10);
    expect(resolveWalletDepositMinimum(base.id, 'USDC', [])).toBe(1);
  });

  // The pipeline credits the wrapped contract; the screen offers the native.
  it('matches a native asset through its wrapped equivalent', () => {
    const assets = [
      asset({ symbol: 'WETH', minimum: '0.004', decimals: 18 }),
      asset({ chainId: fuse.id, chainName: 'Fuse', symbol: 'WFUSE', minimum: '500' }),
    ];

    expect(resolveWalletDepositMinimum(mainnet.id, 'ETH', assets)).toBe(0.004);
    expect(resolveWalletDepositMinimum(mainnet.id, 'WETH', assets)).toBe(0.004);
    expect(resolveWalletDepositMinimum(fuse.id, 'FUSE', assets)).toBe(500);
  });

  it('does not take a published minimum from the wrong chain', () => {
    const assets = [asset({ chainId: base.id, chainName: 'Base', minimum: '99' })];
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', assets)).toBe(10);
  });

  // A malformed or zero figure would quote "Send at least 0", which is no floor.
  it('ignores a published minimum that is not a usable number', () => {
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', [asset({ minimum: '0' })])).toBe(10);
    expect(resolveWalletDepositMinimum(mainnet.id, 'USDC', [asset({ minimum: 'n/a' })])).toBe(10);
  });
});

describe('resolveWalletDepositSymbol', () => {
  it('carries a currency over to a chain that accepts it', () => {
    expect(resolveWalletDepositSymbol(base.id, 'USDC')).toBe('USDC');
    expect(resolveWalletDepositSymbol(mainnet.id, 'USDT')).toBe('USDT');
  });

  // Otherwise the screen would quote a minimum for a pairing that does not exist.
  it('falls back when the chain does not carry it', () => {
    expect(resolveWalletDepositSymbol(base.id, 'USDT')).toBe('USDC');
    expect(resolveWalletDepositSymbol(base.id, 'ETH')).toBe('USDC');
    expect(resolveWalletDepositSymbol(fuse.id, 'ETH')).toBe('FUSE');
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
   * Fuse, not Ethereum. The address shown is the user's Safe on whichever chain
   * is picked — it is not a bridge — so a deposit made on the default lands on
   * the default. Everything the balance is then spent on (the card, the vaults,
   * the annual membership charge) is on Fuse, and the membership charge can
   * only ever move Fuse USDC.e.
   */
  it('opens on USDC over Fuse', () => {
    expect(getDefaultWalletDepositSelection()).toEqual({ chainId: fuse.id, symbol: 'USDC' });
  });

  it('offers USDC on the chain it opens on', () => {
    const { chainId, symbol } = getDefaultWalletDepositSelection();
    expect(getWalletDepositTokens(chainId).map(token => token.symbol)).toContain(symbol);
  });
});

describe('getAllWalletDepositTokens', () => {
  it('lists every currency some chain accepts, once', () => {
    const symbols = getAllWalletDepositTokens().map(token => token.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols).toEqual(expect.arrayContaining(['USDC', 'USDT', 'ETH', 'FUSE']));
  });

  // Derived from chain order alone this read USDC, FUSE, USDT, WFUSE, ETH —
  // Fuse's pair riding up the list purely because Fuse is the default chain.
  it("leads with the currencies people look for, not the default chain's", () => {
    const symbols = getAllWalletDepositTokens().map(token => token.symbol);
    expect(symbols.slice(0, 3)).toEqual(['USDC', 'USDT', 'ETH']);
  });
});

describe('getWalletDepositNetworksForToken', () => {
  it('only offers the chains that carry the currency', () => {
    expect(getWalletDepositNetworksForToken('ETH').map(network => network.chainId)).toEqual([
      mainnet.id,
    ]);
    expect(getWalletDepositNetworksForToken('USDT').map(network => network.chainId)).not.toContain(
      base.id,
    );
  });

  it('offers every chain when no currency is chosen', () => {
    expect(getWalletDepositNetworksForToken(undefined)).toEqual(getWalletDepositNetworks());
  });
});

describe('resolveWalletDepositChain', () => {
  it('opens on Fuse when Fuse carries the currency', () => {
    expect(resolveWalletDepositChain('USDC')).toBe(fuse.id);
  });

  it('falls back to a chain that carries it when Fuse does not', () => {
    expect(resolveWalletDepositChain('ETH')).toBe(mainnet.id);
  });

  // Changing only the currency from the address screen should not move the chain.
  it('keeps the current chain when it carries the currency', () => {
    expect(resolveWalletDepositChain('USDC', polygon.id)).toBe(polygon.id);
    expect(resolveWalletDepositChain('ETH', polygon.id)).toBe(mainnet.id);
  });
});
