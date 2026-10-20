import { arbitrum, base, bsc, fuse, mainnet, polygon } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { ADDRESSES, PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType, Vault, VaultType } from '@/lib/types';
import {
  getAllowedTokensForChain,
  getDefaultDepositSelection,
  getEarningTokenVault,
  getLargestDepositSelection,
  getVaultDepositToken,
  hasDepositableWalletBalance,
  isVaultShareToken,
} from '@/lib/vaults';

const vaultFor = (type: VaultType) => VAULTS.find(vault => vault.type === type)!;

const token = (
  contractTickerSymbol: string,
  chainId: number,
  balance = '1000000',
): TokenBalance => ({
  contractTickerSymbol,
  contractName: contractTickerSymbol,
  contractAddress: `0x${contractTickerSymbol}`,
  balance,
  contractDecimals: 6,
  type: TokenType.ERC20,
  chainId,
});

describe('earning token identity', () => {
  it.each([
    [PRODUCTION_VAULT_ADDRESSES.fuse.vault, fuse.id, VaultType.USDC],
    [PRODUCTION_VAULT_ADDRESSES.ethereum.vault, mainnet.id, VaultType.USDC],
    [PRODUCTION_VAULT_ADDRESSES.ethereum.vault, base.id, VaultType.USDC],
    [PRODUCTION_VAULT_ADDRESSES.ethereum.vault, arbitrum.id, VaultType.USDC],
    [PRODUCTION_VAULT_ADDRESSES.fuse.fuseVault, fuse.id, VaultType.FUSE],
    [PRODUCTION_VAULT_ADDRESSES.ethereum.soEthVault, mainnet.id, VaultType.ETH],
    [PRODUCTION_VAULT_ADDRESSES.fuse.soEthVault, fuse.id, VaultType.ETH],
  ])('recognizes a production share on its supported network', (contractAddress, chainId, type) => {
    expect(getEarningTokenVault({ contractAddress, chainId })?.vault.type).toBe(type);
  });
  it('does not assign vault APY to a copied ticker, an underlying coin, or the wrong chain', () => {
    expect(getEarningTokenVault(token('soUSD', fuse.id))).toBeUndefined();
    expect(getEarningTokenVault(token('USDC', fuse.id))).toBeUndefined();
    expect(
      getEarningTokenVault({
        contractAddress: PRODUCTION_VAULT_ADDRESSES.fuse.vault,
        chainId: polygon.id,
      }),
    ).toBeUndefined();
  });
});

describe('hasDepositableWalletBalance', () => {
  it('accepts a token the vault takes, on a chain it takes', () => {
    expect(hasDepositableWalletBalance([token('USDC', polygon.id)], vaultFor(VaultType.USDC))).toBe(
      true,
    );
    expect(hasDepositableWalletBalance([token('ETH', mainnet.id)], vaultFor(VaultType.ETH))).toBe(
      true,
    );
    expect(hasDepositableWalletBalance([token('FUSE', fuse.id)], vaultFor(VaultType.FUSE))).toBe(
      true,
    );
  });

  // The whole point of the check: the "Move from wallet" row must not be offered
  // to someone whose only holdings land in a different vault.
  it('rejects funds the vault cannot take', () => {
    expect(hasDepositableWalletBalance([token('FUSE', fuse.id)], vaultFor(VaultType.USDC))).toBe(
      false,
    );
    expect(hasDepositableWalletBalance([token('USDC', mainnet.id)], vaultFor(VaultType.ETH))).toBe(
      false,
    );
  });

  // soETH deposits go out from Ethereum, so ETH sitting on another chain is not
  // something this form can move.
  it('rejects an accepted token held on an unsupported chain', () => {
    expect(hasDepositableWalletBalance([token('ETH', polygon.id)], vaultFor(VaultType.ETH))).toBe(
      false,
    );
  });

  it('rejects a zero balance and an empty wallet', () => {
    expect(
      hasDepositableWalletBalance([token('USDC', mainnet.id, '0')], vaultFor(VaultType.USDC)),
    ).toBe(false);
    expect(hasDepositableWalletBalance([], vaultFor(VaultType.USDC))).toBe(false);
  });

  it('matches symbols case-insensitively', () => {
    expect(hasDepositableWalletBalance([token('usdc', mainnet.id)], vaultFor(VaultType.USDC))).toBe(
      true,
    );
  });

  // No vault means the permissive default config (every bridged chain/token).
  it('falls back to the default config with no vault', () => {
    expect(hasDepositableWalletBalance([token('USDC', mainnet.id)])).toBe(true);
  });
});

describe('getLargestDepositSelection', () => {
  const usd = vaultFor(VaultType.USDC);

  // The reason it exists: the form used to open on whichever chain was used
  // last (often Fuse), not where the money is.
  it('picks the chain holding the most of what the vault takes', () => {
    expect(
      getLargestDepositSelection(
        [
          token('USDC', fuse.id, '1000000'),
          token('USDC', polygon.id, '25000000'),
          token('USDT', arbitrum.id, '5000000'),
        ],
        usd,
      ),
    ).toEqual({ chainId: polygon.id, principalToken: 'USDC' });
  });

  it('picks the token as well as the chain', () => {
    expect(
      getLargestDepositSelection(
        [token('USDC', arbitrum.id, '1000000'), token('USDT', arbitrum.id, '3000000')],
        usd,
      ),
    ).toEqual({ chainId: arbitrum.id, principalToken: 'USDT' });
  });

  // BSC stablecoins carry 18 decimals, so raw balances do not compare.
  it('compares amounts, not raw balances, across decimals', () => {
    expect(
      getLargestDepositSelection(
        [
          { ...token('USDC', bsc.id, '2000000000000000000'), contractDecimals: 18 },
          token('USDC', polygon.id, '1500000'),
        ],
        usd,
      ),
    ).toEqual({ chainId: bsc.id, principalToken: 'USDC' });
  });

  it('skips tokens and chains the vault does not take, and empty balances', () => {
    expect(
      getLargestDepositSelection(
        [
          token('FUSE', fuse.id, '900000000'),
          token('USDC', mainnet.id, '0'),
          token('USDC', base.id, '2000000'),
        ],
        usd,
      ),
    ).toEqual({ chainId: base.id, principalToken: 'USDC' });
    expect(
      getLargestDepositSelection(
        [token('ETH', polygon.id, '900000000'), token('ETH', mainnet.id, '1000000')],
        vaultFor(VaultType.ETH),
      ),
    ).toEqual({ chainId: mainnet.id, principalToken: 'ETH' });
  });

  it('picks between the forms of one asset', () => {
    expect(
      getLargestDepositSelection(
        [token('FUSE', fuse.id, '1000000'), token('WFUSE', fuse.id, '3000000')],
        vaultFor(VaultType.FUSE),
      ),
    ).toEqual({ chainId: fuse.id, principalToken: 'WFUSE' });
  });

  // The form selects by BRIDGE_TOKENS key, whatever case the balance came in.
  it('returns the token key for a differently cased symbol', () => {
    expect(getLargestDepositSelection([token('usdc', polygon.id)], usd)).toEqual({
      chainId: polygon.id,
      principalToken: 'USDC',
    });
  });

  it('keeps the first of equal holdings', () => {
    expect(
      getLargestDepositSelection([token('USDC', polygon.id), token('USDC', arbitrum.id)], usd),
    ).toEqual({ chainId: polygon.id, principalToken: 'USDC' });
  });

  it('returns nothing when the wallet holds nothing the vault takes', () => {
    expect(getLargestDepositSelection([], usd)).toBeUndefined();
    expect(getLargestDepositSelection([token('FUSE', fuse.id)], usd)).toBeUndefined();
  });
});

describe('the EUR vault (soEURC)', () => {
  // jest runs without EXPO_PUBLIC_ENVIRONMENT, i.e. as a QA/preview build.
  it('is listed last on QA/preview builds, so persisted vault indices keep their vault', () => {
    expect(VAULTS[VAULTS.length - 1].type).toBe(VaultType.EUR);
    expect(VAULTS.slice(0, 3).map(vault => vault.type)).toEqual([
      VaultType.USDC,
      VaultType.FUSE,
      VaultType.ETH,
    ]);
    expect(vaultFor(VaultType.EUR)).toMatchObject({
      name: 'EUR',
      vaultToken: 'soEURC',
      decimals: 6,
      vaults: [{ address: ADDRESSES.base.soEurcVault, chainId: base.id }],
      depositConfig: { supportedChains: [base.id], supportedTokens: ['EURC'] },
    });
    // Offered per user (useEurVaultAccess), never shown as "coming soon".
    expect(vaultFor(VaultType.EUR).isComingSoon).toBeFalsy();
  });

  // Listed in production too, so a soEURC held there is recognised and can be withdrawn. Who is
  // offered it is per user: see useEurVaultAccess.
  it('is listed last in production builds as well', () => {
    let vaults: Vault[] = [];
    jest.isolateModules(() => {
      jest.doMock('@/lib/config', () => ({
        ...jest.requireActual('@/lib/config'),
        isDevFeatureEnabled: false,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      vaults = require('@/constants/vaults').VAULTS;
    });
    jest.dontMock('@/lib/config');

    expect(vaults.map(vault => vault.type)).toEqual([
      VaultType.USDC,
      VaultType.FUSE,
      VaultType.ETH,
      VaultType.EUR,
    ]);
  });

  it('takes EURC on Base only', () => {
    const eur = vaultFor(VaultType.EUR);
    expect(getAllowedTokensForChain(base.id, eur)).toEqual(['EURC']);
    expect(getAllowedTokensForChain(mainnet.id, eur)).toEqual([]);
    expect(getDefaultDepositSelection(eur)).toEqual({ chainId: base.id, principalToken: 'EURC' });
    expect(getVaultDepositToken(base.id, 'EURC')).toMatchObject({
      address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
      decimals: 6,
    });

    expect(hasDepositableWalletBalance([token('EURC', base.id)], eur)).toBe(true);
    expect(hasDepositableWalletBalance([token('EURC', mainnet.id)], eur)).toBe(false);
    expect(hasDepositableWalletBalance([token('USDC', base.id)], eur)).toBe(false);
  });

  // EURC is kept out of BRIDGE_TOKENS so it is offered nowhere else.
  it('does not leak EURC into any other vault or the vault-less defaults', () => {
    expect(getAllowedTokensForChain(base.id)).not.toContain('EURC');
    expect(getAllowedTokensForChain(base.id, vaultFor(VaultType.USDC))).not.toContain('EURC');
    expect(hasDepositableWalletBalance([token('EURC', base.id)], vaultFor(VaultType.USDC))).toBe(
      false,
    );
    expect(hasDepositableWalletBalance([token('EURC', base.id)])).toBe(false);
  });

  // qa's deposit form opens on the largest holding the vault takes: EURC on Base.
  it('opens the deposit form on EURC on Base, never on a USD stablecoin', () => {
    expect(
      getLargestDepositSelection(
        [token('USDC', base.id, '900000000'), token('EURC', base.id, '2000000')],
        vaultFor(VaultType.EUR),
      ),
    ).toEqual({ chainId: base.id, principalToken: 'EURC' });
    expect(
      getLargestDepositSelection([token('EURC', base.id, '900000000')], vaultFor(VaultType.USDC)),
    ).toBeUndefined();
  });

  it('recognises the soEURC share on Base, and only there', () => {
    const contractAddress = ADDRESSES.base.soEurcVault;
    expect(getEarningTokenVault({ contractAddress, chainId: base.id })?.vault.type).toBe(
      VaultType.EUR,
    );
    expect(getEarningTokenVault({ contractAddress, chainId: mainnet.id })).toBeUndefined();
    expect(isVaultShareToken(contractAddress)).toBe(true);
  });
});
