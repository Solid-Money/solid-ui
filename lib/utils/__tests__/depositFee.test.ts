import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { CardProvider } from '@/lib/types';
import {
  DEFAULT_DEPOSIT_FEE_RATE_PPM,
  formatDepositFeePercent,
  getDepositFeeDestinationType,
  getDepositFeeRatePpm,
  resolveDepositFeeRatePpm,
} from '@/lib/utils/depositFee';

/** Every chain the deposit screens offer. */
const CHAIN_IDS = [mainnet.id, polygon.id, base.id, arbitrum.id, bsc.id, fuse.id];

const STABLECOINS = ['USDC', 'USDT'];
/** What the wallet flow sends straight to the Safe, with no pipeline in between. */
const NON_STABLECOINS = ['ETH', 'WETH', 'FUSE', 'WFUSE'];

/** The chains a rule is free on, and the fee it charges on every other one. */
const expectFreeOnlyOn = (freeChainIds: number[], feeFor: (chainId: number) => number) => {
  for (const chainId of CHAIN_IDS) {
    expect({ chainId, ratePpm: feeFor(chainId) }).toEqual({
      chainId,
      ratePpm: freeChainIds.includes(chainId) ? 0 : DEFAULT_DEPOSIT_FEE_RATE_PPM,
    });
  }
};

// No card, and the deprecated Bridge card the app treats as no card.
const NO_CARD: [string, CardProvider | null | undefined][] = [
  ['no card', null],
  ['an unresolved issuer', undefined],
  ['a Bridge card', CardProvider.BRIDGE],
];

describe('getDepositFeeRatePpm', () => {
  describe('"Fund your card"', () => {
    it.each(STABLECOINS)('charges a Rain card %s deposit everywhere but Base', symbol => {
      expectFreeOnlyOn([base.id], chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.RAIN, product: 'card', chainId, symbol }),
      );
    });

    // A Wirex card spends from the Safe on Base, and a deposit sent on Fuse is
    // delivered to the Safe there: both are free.
    it.each(STABLECOINS)('charges a Wirex card %s deposit everywhere but Base and Fuse', symbol => {
      expectFreeOnlyOn([base.id, fuse.id], chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.WIREX, product: 'card', chainId, symbol }),
      );
    });

    // EURC is delivered to the Safe on Base whoever issued the card, so Base is
    // its home chain for both, and Fuse is not free for it.
    it.each([CardProvider.RAIN, CardProvider.WIREX, null])(
      'charges a EURC card deposit everywhere but Base (issuer %s)',
      provider => {
        expectFreeOnlyOn([base.id], chainId =>
          getDepositFeeRatePpm({ provider, product: 'card', chainId, symbol: 'EURC' }),
        );
      },
    );
  });

  // The backend prices the wallet's own address on the Rain card row for every
  // program: charged when it bridges the deposit to the Safe on Base.
  describe('wallet deposit, on a wallet address', () => {
    describe.each([
      ...NO_CARD,
      ['a Rain card', CardProvider.RAIN],
      ['a Wirex card', CardProvider.WIREX],
    ] as const)('with %s', (_label, provider) => {
      it.each(STABLECOINS)('charges %s everywhere but Base', symbol => {
        expectFreeOnlyOn([base.id], chainId =>
          getDepositFeeRatePpm({ provider, product: 'wallet', chainId, symbol }),
        );
      });

      // Forwarded to the Safe on the chain it arrived on, not bridged.
      it.each([...NON_STABLECOINS, 'EURC', 'WBTC'])('never charges %s', symbol => {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeRatePpm({ provider, product: 'wallet', chainId, symbol }),
        );
      });

      it('never charges when the currency is not known', () => {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeRatePpm({ provider, product: 'wallet', chainId }),
        );
      });
    });

    it('is the address the wallet screen mints unless it says otherwise', () => {
      expect(
        getDepositFeeRatePpm({
          provider: null,
          product: 'wallet',
          chainId: polygon.id,
          symbol: 'USDT',
          walletAddress: 'WALLET',
        }),
      ).toBe(DEFAULT_DEPOSIT_FEE_RATE_PPM);
    });
  });

  // A Wirex cardholder's dollars on Fuse get a card address on the wallet
  // screen, priced as their card.
  describe('wallet deposit, on a card address', () => {
    it.each(STABLECOINS)('charges a Wirex cardholder %s everywhere but Base and Fuse', symbol => {
      expectFreeOnlyOn([base.id, fuse.id], chainId =>
        getDepositFeeRatePpm({
          provider: CardProvider.WIREX,
          product: 'wallet',
          chainId,
          symbol,
          walletAddress: 'RAIN_CARD',
        }),
      );
    });
  });

  describe('savings deposit', () => {
    it('never charges a Wirex cardholder, on any chain or vault', () => {
      for (const vaultToken of ['soUSD', 'soETH', 'soFUSE', 'soEURC']) {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeRatePpm({
            provider: CardProvider.WIREX,
            product: 'savings',
            chainId,
            vaultToken,
          }),
        );
      }
    });

    describe.each([...NO_CARD, ['a Rain card', CardProvider.RAIN]] as const)(
      'with %s',
      (_label, provider) => {
        it.each([
          ['soUSD', base.id],
          ['soETH', mainnet.id],
          ['soFUSE', fuse.id],
          ['soEURC', base.id],
        ])('charges %s deposits everywhere but its vault chain', (vaultToken, vaultChainId) => {
          expectFreeOnlyOn([vaultChainId], chainId =>
            getDepositFeeRatePpm({ provider, product: 'savings', chainId, vaultToken }),
          );
        });

        it('quotes no fee for a vault it cannot place', () => {
          expectFreeOnlyOn(CHAIN_IDS, chainId =>
            getDepositFeeRatePpm({ provider, product: 'savings', chainId, vaultToken: 'soBTC' }),
          );
          expectFreeOnlyOn(CHAIN_IDS, chainId =>
            getDepositFeeRatePpm({ provider, product: 'savings', chainId }),
          );
        });
      },
    );
  });
});

describe('getDepositFeeDestinationType', () => {
  it('prices each flow on the address it hands out', () => {
    expect(getDepositFeeDestinationType('savings')).toBe('PROTOCOL');
    expect(getDepositFeeDestinationType('card')).toBe('RAIN_CARD');
    expect(getDepositFeeDestinationType('wallet')).toBe('WALLET');
  });

  it('prices a wallet deposit on the card address when that is what was minted', () => {
    expect(getDepositFeeDestinationType('wallet', 'RAIN_CARD')).toBe('RAIN_CARD');
    expect(getDepositFeeDestinationType('wallet', 'WALLET')).toBe('WALLET');
    // Only the wallet screen mints more than one kind.
    expect(getDepositFeeDestinationType('card', 'WALLET')).toBe('RAIN_CARD');
  });
});

describe('resolveDepositFeeRatePpm', () => {
  const rulePpm = DEFAULT_DEPOSIT_FEE_RATE_PPM;

  it("quotes the backend's rate for the route and chain", () => {
    expect(
      resolveDepositFeeRatePpm({
        rulePpm,
        quote: { applies: true, ratePpm: 500 },
        quoteFailed: false,
      }),
    ).toBe(500);
  });

  it('quotes nothing when the backend would not charge', () => {
    expect(
      resolveDepositFeeRatePpm({
        rulePpm,
        quote: { applies: false, ratePpm: 0 },
        quoteFailed: false,
      }),
    ).toBe(0);
  });

  it('keeps a deposit that is free by rule free, whatever the backend says', () => {
    expect(
      resolveDepositFeeRatePpm({
        rulePpm: 0,
        quote: { applies: true, ratePpm: 500 },
        quoteFailed: false,
      }),
    ).toBe(0);
    expect(resolveDepositFeeRatePpm({ rulePpm: 0, quote: undefined, quoteFailed: false })).toBe(0);
  });

  it('waits for the backend rather than quoting a rate it may not charge', () => {
    expect(resolveDepositFeeRatePpm({ rulePpm, quote: undefined, quoteFailed: false })).toBe(
      undefined,
    );
  });

  it('falls back to the default rate, never to free, when the backend cannot be asked', () => {
    expect(resolveDepositFeeRatePpm({ rulePpm, quote: undefined, quoteFailed: true })).toBe(
      DEFAULT_DEPOSIT_FEE_RATE_PPM,
    );
  });
});

describe('formatDepositFeePercent', () => {
  it('quotes the default as the notice shows it', () => {
    expect(formatDepositFeePercent(DEFAULT_DEPOSIT_FEE_RATE_PPM)).toBe('0.03%');
  });

  it('keeps other rates exact, fractions of a basis point included', () => {
    expect(formatDepositFeePercent(1_000)).toBe('0.1%');
    expect(formatDepositFeePercent(5_000)).toBe('0.5%');
    expect(formatDepositFeePercent(250)).toBe('0.025%');
    expect(formatDepositFeePercent(333)).toBe('0.0333%');
    expect(formatDepositFeePercent(1)).toBe('0.0001%');
    expect(formatDepositFeePercent(10_000)).toBe('1%');
    expect(formatDepositFeePercent(12_500)).toBe('1.25%');
  });
});
