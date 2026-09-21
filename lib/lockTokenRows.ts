import { ZAP_NATIVE_ASSET } from '@/lib/abis/SolidTierLockZap';
import {
  availableLockAssets,
  LOCK_PAYMENT_ASSETS,
  type LockPaymentAsset,
  lockPaymentBalance,
  type LockPaymentBalances,
} from '@/lib/tierLockPayment';
import { fuseToWei } from '@/lib/tierUpgrade';
import { type TokenBalance, TokenType } from '@/lib/types';

/** The full name under each ticker, as the shared token list renders it. */
const LOCK_TOKEN_NAME: Record<LockPaymentAsset, string> = {
  FUSE: 'Fuse',
  WFUSE: 'Wrapped Fuse',
  soFUSE: 'Solid Savings Fuse',
};

/** Where each token's address comes from, when the backend has named one. */
export interface LockTokenAddresses {
  /** WFUSE. */
  wrappedNativeAddress?: string | null;
  /** soFUSE, the vault share token. */
  shareTokenAddress?: string | null;
}

/**
 * A stable identity for a token the backend has not named an address for.
 *
 * `WalletTokenList` keys and selects on `contractAddress` + `chainId`, so two
 * rows sharing a blank address would collapse into one key and highlight
 * together. Contracts are configuration and can be missing in an environment
 * that has not been wired up yet, which is exactly when a picker rendering one
 * row instead of three is hardest to diagnose.
 */
const placeholderAddress = (asset: LockPaymentAsset) => `lock-token:${asset}`;

/** The on-chain address a row stands for, when there is one. */
export const lockTokenAddress = (
  asset: LockPaymentAsset,
  addresses: LockTokenAddresses,
): string | null => {
  if (asset === 'FUSE') return ZAP_NATIVE_ASSET;
  if (asset === 'WFUSE') return addresses.wrappedNativeAddress ?? null;
  return addresses.shareTokenAddress ?? null;
};

interface LockTokenRowInput {
  asset: LockPaymentAsset;
  /** Every balance the lock could be paid from, in FUSE. */
  balances: LockPaymentBalances;
  addresses: LockTokenAddresses;
  chainId: number;
  /** FUSE spot. 0 where the row has no dollar column to fill. */
  fusePriceUsd?: number;
}

/**
 * One payment option, as a row for the app's shared token components.
 *
 * The balance is converted to FUSE first. That is the unit the tier threshold
 * is set in, and it is the only way the options can be read against each other:
 * soFUSE shares and FUSE are different numbers for the same money, and a row
 * quoting shares would ask the user to apply the vault's exchange rate in their
 * head to find out whether their balance covers the upgrade.
 *
 * Priced with the FUSE spot price for the same reason — one rate across all
 * three, so the dollar column ranks them the way the FUSE column does.
 */
export const lockTokenRow = ({
  asset,
  balances,
  addresses,
  chainId,
  fusePriceUsd = 0,
}: LockTokenRowInput): TokenBalance => ({
  contractTickerSymbol: asset,
  contractName: LOCK_TOKEN_NAME[asset],
  contractAddress: lockTokenAddress(asset, addresses) ?? placeholderAddress(asset),
  // In FUSE, not in the token's own units — see above.
  balance: fuseToWei(lockPaymentBalance(asset, balances)).toString(),
  contractDecimals: 18,
  quoteRate: fusePriceUsd,
  type: asset === 'FUSE' ? TokenType.NATIVE : TokenType.ERC20,
  chainId,
});

/** Every payment option the lock can be offered with right now. */
export const lockTokenRows = ({
  zapAvailable,
  ...row
}: Omit<LockTokenRowInput, 'asset'> & {
  /** Whether the zap can deposit and lock in one transaction. */
  zapAvailable: boolean;
}): TokenBalance[] =>
  availableLockAssets(zapAvailable).map(asset => lockTokenRow({ asset, ...row }));

/**
 * Which asset a selected row is.
 *
 * Matched on the ticker rather than the address: the rows are built here, so
 * the ticker is exactly one of the three, and an address read back from a
 * config that has since changed would resolve to nothing.
 */
export const lockAssetFromRow = (token: TokenBalance): LockPaymentAsset | undefined =>
  LOCK_PAYMENT_ASSETS.find(asset => asset === token.contractTickerSymbol);
