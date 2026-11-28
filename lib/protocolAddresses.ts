import { ADDRESSES } from '@/lib/config';

/**
 * Backend smart accounts. Each is a SimpleAccount at the same address on every
 * chain; they pull and bridge deposits and hold the backend's float. A deposit
 * pull from a user's Safe is indexed as a plain send to one, so they used to
 * show up as recent recipients — users then sent soUSD to the Connect-Wallet
 * account, where nothing credits it back (Nov 2026).
 */
const CONNECT_WALLET_ACCOUNT = '0x9e852a0D1Bd9738d52b90a5E907138575822D69e';
const DIRECT_DEPOSIT_ACCOUNT = '0x54C11A6185907bC464fa6aCA0901Aea9DbDD08Fe';

/**
 * Solid's own contracts and accounts, never a person's wallet. They must never
 * become a send recipient:
 * - BridgePaymasters: a transfer to one is the source leg of a bridge and
 *   credits no one, and on other chains nothing is deployed at the address. A
 *   Base send to the Fuse paymaster's address lost a user 23.88 USDC (Nov 2026).
 * - The backend smart accounts above.
 */
const PROTOCOL_ADDRESSES = new Set(
  [
    ADDRESSES.fuse.bridgePaymasterAddress,
    ADDRESSES.ethereum.bridgePaymasterAddress,
    CONNECT_WALLET_ACCOUNT,
    DIRECT_DEPOSIT_ACCOUNT,
  ].map(address => address.toLowerCase()),
);

export const isProtocolAddress = (address?: string | null): boolean =>
  !!address && PROTOCOL_ADDRESSES.has(address.toLowerCase());

export const PROTOCOL_ADDRESS_RECIPIENT_ERROR =
  'This address belongs to Solid’s own system, not a wallet. Anything sent to it doesn’t reach anyone. Check the address.';
