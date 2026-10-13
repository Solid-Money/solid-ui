import { VaultType } from '@/lib/types';

type VaultValues = Partial<Record<VaultType, number>> | undefined;

/** A portfolio can be funded while the vault being viewed is still empty. */
export const hasSelectedVaultFunds = (
  valuesByVault: VaultValues,
  vaultType: VaultType,
  hasWalletPosition = false,
) => Math.max(valuesByVault?.[vaultType] ?? 0, 0) > 0 || hasWalletPosition;

/**
 * One product's balance from the reads that each see part of it, without counting a share
 * twice.
 *
 * - `portfolioUsd`: the portfolio's value, with shares on every network and shares backing
 *   the card.
 * - `unreadUsd`: shares the savings reads miss (a production soUSD on a development build),
 *   which the portfolio files under wallet tokens instead.
 * - `vaultReadUsd`: the direct savings read.
 * - `walletUsd`: the wallet's tokens grouped by symbol. That already includes the unread
 *   shares, so it is never added to them.
 */
export const productBalanceUsd = ({
  portfolioUsd = 0,
  unreadUsd = 0,
  vaultReadUsd = 0,
  walletUsd = 0,
}: {
  portfolioUsd?: number;
  unreadUsd?: number;
  vaultReadUsd?: number;
  walletUsd?: number;
}) => Math.max(portfolioUsd + unreadUsd, vaultReadUsd, walletUsd, 0);
