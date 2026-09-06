import { fuse, mainnet, polygon } from 'viem/chains';

import { VAULTS } from '@/constants/vaults';
import { TokenBalance, TokenType, VaultType } from '@/lib/types';
import { hasDepositableWalletBalance } from '@/lib/vaults';

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
