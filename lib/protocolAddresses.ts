import { ADDRESSES } from '@/lib/config';

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

export const isBridgePaymasterAddress = (address?: string | null): boolean =>
  !!address && BRIDGE_PAYMASTERS.has(address.toLowerCase());

export const BRIDGE_PAYMASTER_RECIPIENT_ERROR =
  'This is Solid’s bridge contract, not a wallet. Anything sent to it is lost. Check the address.';
