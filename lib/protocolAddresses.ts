import { isAddress } from 'viem';

import { ADDRESSES, EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS } from '@/lib/config';

/**
 * Our own BridgePaymasters. A transfer to one is the source leg of a bridge,
 * never a payment to a person: a plain transfer to the paymaster credits no
 * one, and on every other chain nothing is deployed at these addresses. They
 * must never become a send recipient — a Base send to the Fuse paymaster's
 * address lost a user 23.88 USDC (Nov 2026).
 */
const BRIDGE_PAYMASTERS = new Set(
  [ADDRESSES.fuse.bridgePaymasterAddress, ADDRESSES.ethereum.bridgePaymasterAddress].map(address =>
    address.toLowerCase(),
  ),
);

/**
 * Solid's settlement treasury: card purchases settle to it, and deposit and
 * swap fees are collected there (the backend's `CASH_SETTLEMENT_TREASURY`,
 * `DEPOSIT_FEE_TREASURY` and `LIFI_FEE_WALLET`). It shows up in a cardholder's
 * activity as the recipient of their settlements, which makes it look like
 * someone they once paid.
 */
export const SOLID_SETTLEMENT_TREASURY = '0x6c404c244e1aD2E1CE525492EbBd4a9C12E458aa';

/**
 * Solid addresses that are not anyone's wallet, beyond the paymasters:
 *
 * - The connect-wallet relayer (`EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS`). A
 *   deposit from a wallet sends to it, and that leg is indexed as a plain send,
 *   so it was offered as a recent recipient and saved as a contact ("okx",
 *   "BITGET USDC BASE"), and users sent their soUSD to it on Fuse (Nov 2026).
 * - The settlement treasury, above.
 *
 * Funds sent to either are not lost, but they credit no one, and only a manual
 * transfer by the team returns them.
 */
const SYSTEM_ADDRESSES = new Set(
  [EXPO_PUBLIC_BRIDGE_AUTO_DEPOSIT_ADDRESS, SOLID_SETTLEMENT_TREASURY]
    .filter(address => isAddress(address))
    .map(address => address.toLowerCase()),
);

export const isBridgePaymasterAddress = (address?: string | null): boolean =>
  !!address && BRIDGE_PAYMASTERS.has(address.toLowerCase());

/** Any Solid address a user must not send to or save as a contact. */
export const isSolidSystemAddress = (address?: string | null): boolean =>
  !!address &&
  (BRIDGE_PAYMASTERS.has(address.toLowerCase()) || SYSTEM_ADDRESSES.has(address.toLowerCase()));

export const BRIDGE_PAYMASTER_RECIPIENT_ERROR =
  'This is Solid’s bridge contract, not a wallet. Anything sent to it is lost. Check the address.';

export const SYSTEM_ADDRESS_RECIPIENT_ERROR =
  'This is a Solid system address, not a wallet. Anything sent to it won’t reach anyone. Check the address.';

/** Why this address can't be a recipient, or `null` when it can. */
export const getSystemRecipientError = (address?: string | null): string | null => {
  if (isBridgePaymasterAddress(address)) return BRIDGE_PAYMASTER_RECIPIENT_ERROR;
  if (isSolidSystemAddress(address)) return SYSTEM_ADDRESS_RECIPIENT_ERROR;
  return null;
};
