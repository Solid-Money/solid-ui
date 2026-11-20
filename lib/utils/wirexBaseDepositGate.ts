import { fuse } from 'viem/chains';

/**
 * Where a Wirex cardholder's card deposit on a chain stands, before its address
 * is shown:
 *
 * - `ready`: show the address.
 * - `checking`: whether they turned Base on is still loading; show nothing yet,
 *   rather than an address that may turn out to need Base.
 * - `turn-on-base`: they have not turned Base on, and the deposit would land
 *   in their Safe on Base, where their card cannot spend it until they do.
 */
export type WirexBaseDepositGate = 'ready' | 'checking' | 'turn-on-base';

/**
 * Whether a Wirex cardholder can be shown a card deposit address on `chainId`.
 *
 * Every Wirex card deposit made off Fuse lands in the cardholder's Safe on Base
 * - rhino.fi's wallet route pays out there, and rhino.fi cannot pay out on Fuse
 * at all - and the card spends from that Safe only once its owner turned the
 * Base spend instance on, which takes their own passkey. A cardholder who never
 * did had their deposit delivered and their card unable to touch it: on Nov
 * 10-11 2026, $161 across three cardholders. So the address waits until Base is
 * on. Fuse needs nothing: every Wirex card spends from the Safe on Fuse.
 *
 * `base` is `useEuroSpendEnablement()`: `shouldOffer` is true exactly when this
 * is a Wirex cardholder who has not turned Base on and the app can turn it on
 * for them. When it cannot (Base switched off by the backend, or a build without
 * the Base addresses) the address is shown as before; the backend then routes
 * the card address's own deposits to Fuse.
 */
export const wirexBaseDepositGate = (
  chainId: number | undefined,
  base: { shouldOffer: boolean; isLoading: boolean },
): WirexBaseDepositGate => {
  if (chainId === undefined || chainId === fuse.id) return 'ready';
  if (base.isLoading) return 'checking';
  return base.shouldOffer ? 'turn-on-base' : 'ready';
};
