import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import {
  getDefaultWalletDepositSelection,
  getWalletDepositMinimum,
  getWalletDepositNetworks,
  getWalletDepositTokenIcon,
  getWalletDepositTokens,
  resolveWalletDepositSymbol,
} from '@/components/DepositOption/WalletDepositAddress/constants';

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
    expect(getWalletDepositMinimum(fuse.id, 'FUSE')).toBe(100);
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
