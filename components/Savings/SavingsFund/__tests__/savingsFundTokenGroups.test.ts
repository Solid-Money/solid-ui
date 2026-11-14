import {
  getSavingsFundNetworks,
  getSavingsFundTokenGroups,
  offersExternalWalletFunding,
  SAVINGS_FUND_CRYPTO,
  SAVINGS_FUND_EURC,
  SAVINGS_FUND_STABLECOINS,
} from '@/components/Savings/SavingsFund/constants';
import { VAULTS } from '@/constants/vaults';

// constants.ts resolves token icons through the asset barrel; the group policy
// under test only cares about which tokens are listed.
jest.mock('@/lib/assets', () => ({ getAsset: (path: string) => path }));

describe('getSavingsFundTokenGroups', () => {
  it('offers stablecoins and crypto when no vault is given', () => {
    const { stablecoins, crypto } = getSavingsFundTokenGroups('savings');

    expect(stablecoins.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(crypto.map(t => t.symbol)).toEqual(['ETH', 'WFUSE']);
  });

  // Each vault has its own savings screen, so its Deposit button must not offer
  // tokens that would land in a different vault than the one on screen.
  it('offers only the tokens that fund the selected vault', () => {
    const usd = getSavingsFundTokenGroups('savings', 'soUSD');
    expect(usd.stablecoins.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(usd.crypto).toEqual([]);

    const eth = getSavingsFundTokenGroups('savings', 'soETH');
    expect(eth.stablecoins).toEqual([]);
    expect(eth.crypto.map(t => t.symbol)).toEqual(['ETH']);

    const fuse = getSavingsFundTokenGroups('savings', 'soFUSE');
    expect(fuse.stablecoins).toEqual([]);
    expect(fuse.crypto.map(t => t.symbol)).toEqual(['WFUSE']);
  });

  // A vault whose share token nothing here mints would render the screen with
  // no tokens at all — only the "Other" group — and no way to deposit into it.
  it('offers at least one token for every live vault', () => {
    for (const vault of VAULTS.filter(v => !v.isComingSoon)) {
      const { stablecoins, crypto } = getSavingsFundTokenGroups('savings', vault.vaultToken);

      expect([...stablecoins, ...crypto].length).toBeGreaterThan(0);
    }
  });

  // rhino.fi's soEURC route takes EURC on Ethereum and Base and pays it into
  // soEURC on Base; not Optimism or Arc, though rhino.fi lists both.
  it('offers EURC on Ethereum and Base for the EUR vault, and only there', () => {
    const eur = getSavingsFundTokenGroups('savings', 'soEURC');
    expect(eur.stablecoins).toEqual([SAVINGS_FUND_EURC]);
    expect(eur.crypto).toEqual([]);
    expect(SAVINGS_FUND_EURC).toMatchObject({ vaultToken: 'soEURC', chainIds: [1, 8453] });
    // Base first: soEURC mints there, so a deposit sent there is free.
    expect(getSavingsFundNetworks('EURC').map(network => network.chainId)).toEqual([8453, 1]);

    // Not in the vault-less list, not at the card's soUSD gate, not on another vault.
    for (const [intent, vaultToken] of [
      ['savings', undefined],
      ['card_deposit', undefined],
      ['card_deposit', 'soEURC'],
      ['savings', 'soUSD'],
    ] as const) {
      const { stablecoins, crypto } = getSavingsFundTokenGroups(intent, vaultToken);
      expect([...stablecoins, ...crypto].map(token => token.symbol)).not.toContain('EURC');
    }
  });

  // The card's minimum-deposit gate reads the soUSD balance alone, so depositing
  // the whole minimum as ETH or WFUSE would fund soETH / soFUSE and leave the
  // step stuck at "not met".
  it('offers only the soUSD-minting stablecoins for the card deposit gate', () => {
    const { stablecoins, crypto } = getSavingsFundTokenGroups('card_deposit');

    expect(crypto).toEqual([]);
    expect(stablecoins.map(t => t.vaultToken)).toEqual(['soUSD', 'soUSD']);
  });

  // The card gate opens with whatever vault was last selected, so its intent has
  // to win over the vault rather than offer that vault's tokens.
  it('keeps the card deposit gate on soUSD even when another vault is selected', () => {
    const { stablecoins, crypto } = getSavingsFundTokenGroups('card_deposit', 'soETH');

    expect(stablecoins.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(crypto).toEqual([]);
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
    getSavingsFundTokenGroups('savings', 'soETH');

    expect(SAVINGS_FUND_STABLECOINS.map(t => t.symbol)).toEqual(['USDC', 'USDT']);
    expect(SAVINGS_FUND_CRYPTO.map(t => t.symbol)).toEqual(['ETH', 'WFUSE']);
  });
});

describe('offersExternalWalletFunding', () => {
  it('offers the connect-wallet routes on a normal savings deposit', () => {
    expect(offersExternalWalletFunding('savings')).toBe(true);
  });

  // The card's deposit steps show the direct-deposit path and nothing else:
  // they exist to get money in before we pay a verification fee, they are
  // judged solely on the soUSD balance afterwards, and the connect-wallet route
  // is the least used way of getting there.
  it('withholds them on the card deposit steps', () => {
    expect(offersExternalWalletFunding('card_deposit')).toBe(false);
  });
});

describe('getSavingsFundNetworks', () => {
  // soUSD and soEURC mint on Base, so a deposit sent there is the free one.
  it('lists Base first for a token whose vault is on Base', () => {
    ['USDC', 'EURC'].forEach(symbol =>
      expect(getSavingsFundNetworks(symbol)[0]?.chainId).toBe(8453),
    );
  });

  // soETH mints on Ethereum, where an ETH deposit is the free one.
  it('keeps Ethereum first for ETH', () => {
    expect(getSavingsFundNetworks('ETH').map(network => network.chainId)).toEqual([1, 8453, 42161]);
  });
});
