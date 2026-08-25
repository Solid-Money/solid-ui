import {
  getSavingsFundTokenGroups,
  SAVINGS_FUND_CRYPTO,
  SAVINGS_FUND_STABLECOINS,
} from '@/components/Savings/SavingsFund/constants';

// constants.ts resolves token icons through the asset barrel; the group policy
// under test only cares about which tokens are listed.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));

describe('getSavingsFundTokenGroups', () => {
  it('offers stablecoins and crypto for an ordinary savings deposit', () => {
    const { stablecoins, crypto } = getSavingsFundTokenGroups('savings');

    expect(stablecoins.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(crypto.map(t => t.symbol)).toEqual(['ETH', 'WFUSE']);
  });

  // The card's "Deposit at least $5" gate reads the soUSD balance alone, so a $5
  // deposit of ETH or WFUSE would fund soETH / soFUSE and leave the step stuck.
  it('offers only the soUSD-minting stablecoins for the card deposit gate', () => {
    const { stablecoins, crypto } = getSavingsFundTokenGroups('card_deposit');

    expect(crypto).toEqual([]);
    expect(stablecoins.map(t => t.vaultToken)).toEqual(['soUSD', 'soUSD']);
  });

  it('keeps every offered token mapped to a vault, in both intents', () => {
    for (const intent of ['savings', 'card_deposit'] as const) {
      const { stablecoins, crypto } = getSavingsFundTokenGroups(intent);

      for (const token of [...stablecoins, ...crypto]) {
        expect(token.vaultToken).toBeTruthy();
      }
    }
  });

  it('does not mutate the underlying token lists', () => {
    getSavingsFundTokenGroups('card_deposit');

    expect(SAVINGS_FUND_STABLECOINS.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(SAVINGS_FUND_CRYPTO.map(t => t.symbol)).toEqual(['ETH', 'WFUSE']);
  });
});
