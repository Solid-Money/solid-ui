import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { CardProvider } from '@/lib/types';
import { DEPOSIT_FEE_BPS, formatDepositFeePercent, getDepositFeeBps } from '@/lib/utils/depositFee';

/** Every chain the deposit screens offer. */
const CHAIN_IDS = [mainnet.id, polygon.id, base.id, arbitrum.id, bsc.id, fuse.id];

/** The chains a rule is free on, and the fee it charges on every other one. */
const expectFreeOnlyOn = (freeChainIds: number[], feeFor: (chainId: number) => number) => {
  for (const chainId of CHAIN_IDS) {
    expect({ chainId, bps: feeFor(chainId) }).toEqual({
      chainId,
      bps: freeChainIds.includes(chainId) ? 0 : DEPOSIT_FEE_BPS,
    });
  }
};

describe('getDepositFeeBps', () => {
  describe('Wirex', () => {
    it('charges card deposits everywhere but Fuse', () => {
      expectFreeOnlyOn([fuse.id], chainId =>
        getDepositFeeBps({ provider: CardProvider.WIREX, product: 'card', chainId }),
      );
    });

    it('charges no savings deposit, on any chain or vault', () => {
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
  });

  // No card and a Rain card share the table's rows, and so does the deprecated
  // Bridge card, which the app treats as no card.
  describe.each([
    ['no card', null],
    ['no card yet (loading)', undefined],
    ['a Rain card', CardProvider.RAIN],
    ['a Bridge card', CardProvider.BRIDGE],
  ])('with %s', (_label, provider) => {
    it('charges card deposits everywhere but Base', () => {
      expectFreeOnlyOn([base.id], chainId =>
        getDepositFeeBps({ provider, product: 'card', chainId }),
      );
    });

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
