import { arbitrum, base, fuse, mainnet, polygon } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { PRODUCTION_VAULT_ADDRESSES } from '@/lib/config';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';
import { getEarningTokenVault, hasDepositableWalletBalance } from '@/lib/vaults';

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
