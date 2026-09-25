/**
 * `SolidTierLockZap` — deposit and lock in one transaction.
 *
 * Only `zapAndLock` is here. Everything else the contract exposes is either an
 * owner operation or an immutable the app is told about by the membership
 * payload, so an ABI carrying them would be a second place for those addresses
 * to be read from.
 */
export const SolidTierLockZap_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'uint256', name: 'minShares', type: 'uint256' },
    ],
    name: 'zapAndLock',
    outputs: [{ internalType: 'uint256', name: 'shares', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

/**
 * The Teller's sentinel for "this deposit is the native token".
 *
 * Passed as the asset with the amount sent as value. Same constant the Teller
 * and the zap both use; it is not an address anyone holds.
 */
export const ZAP_NATIVE_ASSET = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;
