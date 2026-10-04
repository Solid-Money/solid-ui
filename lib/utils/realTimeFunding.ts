import type { RainRtfChain, RainRtfStatus } from '@/lib/types';

/**
 * Real-Time Funding presentation helpers.
 *
 * Their own leaf module, with no React and no app imports, for the same reason
 * `cardStatusRouting` and `cardDepositGate` are: they are load-bearing — a
 * wrong allowance comparison hides the approval a card needs, and a wrong
 * amount format misstates somebody's balance — and `@/lib/utils`' import graph
 * does not load under jest-expo, so logic that lives there cannot be tested.
 */

/**
 * A token amount in smallest units, rendered for display.
 *
 * Takes a string because the values it formats come off the wire as strings:
 * an unlimited allowance is `uint256` max, which `number` cannot hold, and a
 * balance parsed through `number` loses precision long before that. The whole
 * part is computed with `BigInt` and only the fraction is ever formatted.
 *
 * Returns `null` for anything that is not a non-negative integer string, so a
 * malformed or absent value renders as "unknown" rather than as `NaN` or, far
 * worse, as `0` — which a cardholder would read as "my wallet is empty".
 */
export const formatTokenAmount = (
  rawAmount: string | null | undefined,
  decimals: number,
  maximumFractionDigits = 2,
): string | null => {
  if (typeof rawAmount !== 'string' || !/^\d+$/.test(rawAmount.trim())) return null;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) return null;

  const amount = BigInt(rawAmount.trim());
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  const wholeText = whole.toLocaleString('en-US');
  if (fraction === 0n || maximumFractionDigits === 0) return wholeText;

  // Left-pad to the token's full precision, then trim to the digits asked for
  // and drop trailing zeros. Slicing before padding would read 1 wei of a 6dp
  // token as 0.1.
  const fractionText = fraction
    .toString()
    .padStart(decimals, '0')
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, '');

  return fractionText ? `${wholeText}.${fractionText}` : wholeText;
};

/**
 * The chain the approve button should act on, and the ones already done.
 *
 * A chain with no spenders is never offered: there is nothing to approve
 * against — Rain has provisioned no collateral contract and the operator is
 * switched off — so offering it would build an empty batch and record a
 * consent for an authorization that does not exist.
 *
 * The *first* unapproved chain rather than a picker, because a cardholder has
 * no basis for choosing between chains and "which chain is my card on" is not
 * a question to put to them. The rest come up on the next open; approving one
 * at a time is also one signature at a time, which is what a wallet can do.
 */
export const selectRtfChains = (
  status: RainRtfStatus | undefined,
): { chain: RainRtfChain | undefined; approvedChains: RainRtfChain[] } => {
  const chains = status?.chains ?? [];
  return {
    chain: chains.find(entry => !entry.isApproved && entry.spenders.length > 0),
    approvedChains: chains.filter(entry => entry.isApproved),
  };
};

/**
 * Whether the card screen should render the Real-Time Funding row.
 *
 * Every condition has to hold: the card is a Rain card (RTF is a Rain feature
 * and there is no collateral contract to pull into otherwise), Rain has
 * enabled the tenant, this cardholder is eligible, and a chain is still
 * waiting on an approval. The last one is what makes the row a task rather
 * than a setting — it disappears the moment the allowance lands.
 */
export const shouldOfferRtf = (params: {
  isRainCard: boolean;
  status: RainRtfStatus | undefined;
}): boolean => {
  const { isRainCard, status } = params;
  if (!isRainCard || !status?.tenantEnabled || !status.eligible) return false;
  return selectRtfChains(status).chain !== undefined;
};
