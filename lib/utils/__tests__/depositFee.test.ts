import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { CardProvider } from '@/lib/types';
import { DEPOSIT_FEE_BPS, formatDepositFeePercent, getDepositFeeBps } from '@/lib/utils/depositFee';

/** Every chain the deposit screens offer. */
const CHAIN_IDS = [mainnet.id, polygon.id, base.id, arbitrum.id, bsc.id, fuse.id];

const STABLECOINS = ['USDC', 'USDT'];
/** What the wallet flow sends straight to the Safe, with no pipeline in between. */
const NON_STABLECOINS = ['ETH', 'WETH', 'FUSE', 'WFUSE'];

/** The chains a rule is free on, and the fee it charges on every other one. */
const expectFreeOnlyOn = (freeChainIds: number[], feeFor: (chainId: number) => number) => {
  for (const chainId of CHAIN_IDS) {
    expect({ chainId, bps: feeFor(chainId) }).toEqual({
      chainId,
      bps: freeChainIds.includes(chainId) ? 0 : DEPOSIT_FEE_BPS,
    });
  }
};

// No card, and the deprecated Bridge card the app treats as no card.
const NO_CARD: [string, CardProvider | null | undefined][] = [
  ['no card', null],
  ['an unresolved issuer', undefined],
  ['a Bridge card', CardProvider.BRIDGE],
];

describe('getDepositFeeBps', () => {
  describe('"Fund your card"', () => {
    it.each(STABLECOINS)('charges a Rain card %s deposit everywhere but Base', symbol => {
      expectFreeOnlyOn([base.id], chainId =>
        getDepositFeeBps({ provider: CardProvider.RAIN, product: 'card', chainId, symbol }),
      );
    });

    it.each(STABLECOINS)('charges a Wirex card %s deposit everywhere but Fuse', symbol => {
      expectFreeOnlyOn([fuse.id], chainId =>
        getDepositFeeBps({ provider: CardProvider.WIREX, product: 'card', chainId, symbol }),
      );
    });
  });

  describe('wallet deposit', () => {
    it.each(STABLECOINS)('charges a Wirex cardholder %s everywhere but Fuse', symbol => {
      expectFreeOnlyOn([fuse.id], chainId =>
        getDepositFeeBps({ provider: CardProvider.WIREX, product: 'wallet', chainId, symbol }),
      );
    });

    it.each(NON_STABLECOINS)('never charges a Wirex cardholder %s', symbol => {
      expectFreeOnlyOn(CHAIN_IDS, chainId =>
        getDepositFeeBps({ provider: CardProvider.WIREX, product: 'wallet', chainId, symbol }),
      );
    });

    it('never charges a Wirex cardholder when the currency is not known', () => {
      expectFreeOnlyOn(CHAIN_IDS, chainId =>
        getDepositFeeBps({ provider: CardProvider.WIREX, product: 'wallet', chainId }),
      );
    });

    it.each(NO_CARD)('never charges someone with %s', (_label, provider) => {
      for (const symbol of [...STABLECOINS, ...NON_STABLECOINS]) {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeBps({ provider, product: 'wallet', chainId, symbol }),
        );
      }
    });
  });

  describe('savings deposit', () => {
    it('never charges a Wirex cardholder, on any chain or vault', () => {
      for (const vaultToken of ['soUSD', 'soETH', 'soFUSE']) {
        expectFreeOnlyOn(CHAIN_IDS, chainId =>
          getDepositFeeBps({
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
          ['soUSD', mainnet.id],
          ['soETH', mainnet.id],
          ['soFUSE', fuse.id],
        ])('charges %s deposits everywhere but its vault chain', (vaultToken, vaultChainId) => {
          expectFreeOnlyOn([vaultChainId], chainId =>
            getDepositFeeBps({ provider, product: 'savings', chainId, vaultToken }),
          );
        });

        it('quotes no fee for a vault it cannot place', () => {
          expectFreeOnlyOn(CHAIN_IDS, chainId =>
            getDepositFeeBps({ provider, product: 'savings', chainId, vaultToken: 'soBTC' }),
          );
          expectFreeOnlyOn(CHAIN_IDS, chainId =>
            getDepositFeeBps({ provider, product: 'savings', chainId }),
          );
        });
      },
    );
  });
});

describe('formatDepositFeePercent', () => {
  it('quotes the fee as the notice shows it', () => {
    expect(formatDepositFeePercent(DEPOSIT_FEE_BPS)).toBe('0.03%');
  });

  it('keeps other rates exact', () => {
    expect(formatDepositFeePercent(10)).toBe('0.1%');
    expect(formatDepositFeePercent(50)).toBe('0.5%');
  });
});
