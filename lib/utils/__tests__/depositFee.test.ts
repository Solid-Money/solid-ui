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

    it.each(STABLECOINS)('charges a Wirex card %s deposit everywhere but Fuse', symbol => {
      expectFreeOnlyOn([fuse.id], chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.WIREX, product: 'card', chainId, symbol }),
      );
    });

    // EURC is delivered to the Safe on Base whoever issued the card, so Base is
    // its home chain for both - including a Wirex holder, whose dollars go to Fuse.
    it.each([CardProvider.RAIN, CardProvider.WIREX, null])(
      'charges a EURC card deposit everywhere but Base (issuer %s)',
      provider => {
        expectFreeOnlyOn([base.id], chainId =>
          getDepositFeeRatePpm({ provider, product: 'card', chainId, symbol: 'EURC' }),
        );
      },
    );
  });

  describe('wallet deposit', () => {
    it.each(STABLECOINS)('charges a Wirex cardholder %s everywhere but Fuse', symbol => {
      expectFreeOnlyOn([fuse.id], chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.WIREX, product: 'wallet', chainId, symbol }),
      );
    });

    it('charges a Wirex cardholder EURC everywhere but Base, where it is delivered', () => {
      expectFreeOnlyOn([base.id], chainId =>
        getDepositFeeRatePpm({
          provider: CardProvider.WIREX,
          product: 'wallet',
          chainId,
          symbol: 'EURC',
        }),
      );
    });

    it.each(NON_STABLECOINS)('never charges a Wirex cardholder %s', symbol => {
      expectFreeOnlyOn(CHAIN_IDS, chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.WIREX, product: 'wallet', chainId, symbol }),
      );
    });

    it('never charges a Wirex cardholder when the currency is not known', () => {
      expectFreeOnlyOn(CHAIN_IDS, chainId =>
        getDepositFeeRatePpm({ provider: CardProvider.WIREX, product: 'wallet', chainId }),
      );
    });

    it.each(NO_CARD)('never charges someone with %s', (_label, provider) => {
      for (const symbol of [...STABLECOINS, ...NON_STABLECOINS]) {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeRatePpm({ provider, product: 'wallet', chainId, symbol }),
        );
      }
    });
  });

  describe('savings deposit', () => {
    it('never charges a Wirex cardholder, on any chain or vault', () => {
      for (const vaultToken of ['soUSD', 'soETH', 'soFUSE']) {
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
          ['soETH', mainnet.id],
          ['soFUSE', fuse.id],
        ])('charges %s deposits everywhere but its vault chain', (vaultToken, vaultChainId) => {
          expectFreeOnlyOn([vaultChainId], chainId =>
            getDepositFeeRatePpm({ provider, product: 'savings', chainId, vaultToken }),
          );
        });

        // soUSD's home moves from Ethereum to Base on a backend switch, and the
        // backend quotes its home chain as free, so it is asked everywhere.
        it('asks the backend about soUSD deposits on every chain', () => {
          expectFreeOnlyOn([], chainId =>
            getDepositFeeRatePpm({ provider, product: 'savings', chainId, vaultToken: 'soUSD' }),
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
  it('prices savings on the savings address and every other flow on the card one', () => {
    expect(getDepositFeeDestinationType('savings')).toBe('PROTOCOL');
    expect(getDepositFeeDestinationType('card')).toBe('RAIN_CARD');
    expect(getDepositFeeDestinationType('wallet')).toBe('RAIN_CARD');
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
