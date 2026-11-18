import { formatUnits, parseUnits } from 'viem';
import { fuse } from 'viem/chains';

import { covers } from '@/lib/tierUpgrade';
import { TokenBalance, TokenType } from '@/lib/types';
import { isSolidVaultShare, meetsSwapThreshold } from '@/lib/utils/cardFundMove';

import type { TrackedLifiSwap } from '@/store/lifiSwapStore';

/**
 * How much over the shortfall a bridged payment sends, as a fraction.
 *
 * The backend values what was sent at LI.FI's price for the token, and the
 * amount is worked out here from the price the wallet shows, which can sit a
 * hair below it. Sending exactly the shortfall would then read as a fraction
 * short and the first charge would fail by cents. Whatever the buffer buys
 * beyond the fee stays in the user's Safe as USDC.
 */
export const FUNDING_PRICE_BUFFER = 0.005;

/** USDC, the token every membership is billed in. */
const BILLING_DECIMALS = 6;

/** Which token pays: a chain and an address. The zero address is native. */
export interface CashTokenKey {
  chainId: number;
  address: string;
}

export const cashTokenKey = (token: Pick<TokenBalance, 'chainId' | 'contractAddress'>) =>
  `${token.chainId}:${token.contractAddress.toLowerCase()}`;

const rawBalance = (token: TokenBalance): bigint => {
  try {
    return BigInt(token.balance || '0');
  } catch {
    return 0n;
  }
};

/** A row's balance in its own token, for display. */
export const tokenAmount = (token: TokenBalance) =>
  Number(formatUnits(rawBalance(token), token.contractDecimals));

/** A row's balance in dollars, at the rate the wallet shows. */
export const tokenUsd = (token: TokenBalance) => tokenAmount(token) * (token.quoteRate ?? 0);

/** Whether a row is the USDC on Fuse that a membership is billed in. */
export const isBillingToken = (token: TokenBalance, billingTokenAddress: string) =>
  token.chainId === fuse.id &&
  token.contractAddress.toLowerCase() === billingTokenAddress.toLowerCase();

/**
 * The row for USDC already on Fuse, built from the balance the upgrade screen
 * reads off the chain rather than from the wallet indexer, so it agrees with
 * the "Your balance" line under it to the cent.
 */
export const billingTokenRow = ({
  address,
  balanceRaw,
}: {
  address: string;
  balanceRaw: bigint;
}): TokenBalance => ({
  contractTickerSymbol: 'USDC',
  contractName: 'USD Coin',
  contractAddress: address,
  balance: balanceRaw.toString(),
  contractDecimals: BILLING_DECIMALS,
  quoteRate: 1,
  type: TokenType.ERC20,
  chainId: fuse.id,
});

/**
 * Everything that can pay the annual fee: USDC on Fuse first, then whatever
 * the user holds on another chain the swap reaches.
 *
 * A holding qualifies when it is on a LI.FI swap chain other than Fuse — LI.FI
 * has no same-chain route into Fuse USDC, so a Fuse token would open a quote
 * that can never come back — is not a Solid savings share (those are savings,
 * and leaving them is a withdrawal, not a sale), and is priced at $1 or more.
 * The price is also what keeps an unlisted airdrop off the list.
 */
export const cashFundingTokens = ({
  tokens,
  billing,
  lifiChainIds,
}: {
  tokens: TokenBalance[] | undefined;
  billing: TokenBalance;
  lifiChainIds: readonly number[];
}): TokenBalance[] => [
  billing,
  ...(tokens ?? []).filter(
    token =>
      token.chainId !== fuse.id &&
      lifiChainIds.includes(token.chainId) &&
      !!token.contractAddress &&
      !isSolidVaultShare(token.contractTickerSymbol) &&
      meetsSwapThreshold(rawBalance(token), token.contractDecimals, token.quoteRate ?? 0),
  ),
];

/** What is still missing on Fuse for the fee, in dollars. */
export const fundingNeedUsd = (feeUsd: number, fuseUsdc: number) =>
  Math.max(0, feeUsd - Math.max(0, fuseUsdc));

/**
 * How much of `token` to send so that `usd` reaches Fuse in value, in its raw
 * units: the shortfall plus the buffer, rounded up at six places (fewer when
 * the token has fewer), and never more than the user holds.
 *
 * `priceUsd` is LI.FI's own price once a quote has named one — the price the
 * backend values the transfer at — and the wallet's until then.
 */
export const fundingSendAmount = ({
  usd,
  token,
  priceUsd,
}: {
  usd: number;
  token: TokenBalance;
  priceUsd?: number;
}): bigint | undefined => {
  const price = priceUsd && priceUsd > 0 ? priceUsd : (token.quoteRate ?? 0);
  if (!Number.isFinite(price) || price <= 0 || !(usd > 0)) return undefined;

  const places = Math.min(6, token.contractDecimals);
  const scale = 10 ** places;
  const wanted = Math.ceil(((usd * (1 + FUNDING_PRICE_BUFFER)) / price) * scale) / scale;
  if (!Number.isFinite(wanted) || wanted <= 0) return undefined;

  try {
    const units = parseUnits(wanted.toFixed(places), token.contractDecimals);
    const balance = rawBalance(token);
    const capped = units < balance ? units : balance;
    return capped > 0n ? capped : undefined;
  } catch {
    return undefined;
  }
};

/**
 * What the first charge will absorb of a bridged payment that landed short.
 *
 * Mirrors the backend's `fundedFirstCharge`, cent for cent, so the button
 * lights up exactly when the charge will go through — the charge itself is
 * still decided server-side, from LI.FI's own record of the transfer. The
 * smallest of the allowance, what the transfer lost, and what is missing.
 */
export const estimateFundingCoverUsd = ({
  feeUsd,
  fuseUsdc,
  coverPct,
  sentUsd,
  receivedUsd,
}: {
  feeUsd: number;
  fuseUsdc: number;
  coverPct: number;
  sentUsd: number;
  receivedUsd: number;
}): number => {
  if (!(coverPct > 0) || !Number.isFinite(sentUsd) || !Number.isFinite(receivedUsd)) return 0;
  const priceCents = Math.round(feeUsd * 100);
  const balanceCents = Math.floor(Math.max(0, fuseUsdc) * 100 + 1e-6);
  const allowanceCents = Math.floor((priceCents * coverPct) / 100);
  const lostCents = Math.max(0, Math.ceil((sentUsd - receivedUsd) * 100 - 1e-6));
  const missingCents = Math.max(0, priceCents - balanceCents);
  return Math.min(allowanceCents, lostCents, missingCents) / 100;
};

/** The latest swap made to pay for an upgrade, and where it has got to. */
export type UpgradeFunding =
  | { state: 'none' }
  | { state: 'pending'; swap: TrackedLifiSwap }
  | { state: 'arrived'; swap: TrackedLifiSwap }
  | { state: 'failed'; swap: TrackedLifiSwap };

/**
 * The user's most recent upgrade payment that no membership has used yet.
 *
 * Only the latest counts: an older one is either already spent, or was the
 * attempt the user has since made another to replace. "Arrived" is DONE with
 * USDC delivered — a refund or a delivery in some other token is a failure as
 * far as the membership is concerned, because neither left USDC to bill.
 */
export const latestUpgradeFunding = (
  swaps: Record<string, TrackedLifiSwap>,
  userId: string | undefined,
): UpgradeFunding => {
  if (!userId) return { state: 'none' };
  const latest = Object.values(swaps)
    .filter(swap => swap.userId === userId && swap.purpose === 'tier_upgrade' && !swap.consumed)
    .sort((a, b) => b.submittedAt - a.submittedAt)[0];
  if (!latest) return { state: 'none' };

  // COMPLETED exactly, as the backend requires it: anything else DONE can be
  // is a refund or a delivery in another token.
  if (latest.status === 'DONE') {
    return latest.substatus === 'COMPLETED'
      ? { state: 'arrived', swap: latest }
      : { state: 'failed', swap: latest };
  }
  if (latest.status === 'FAILED' || latest.status === 'INVALID') {
    return { state: 'failed', swap: latest };
  }
  return { state: 'pending', swap: latest };
};

/**
 * The cover an arrived payment earns, from what the app knows of it: the
 * quote's dollar value of what was sent and the USDC the watcher saw land.
 */
export const arrivedFundingCoverUsd = ({
  funding,
  feeUsd,
  fuseUsdc,
  coverPct,
}: {
  funding: UpgradeFunding;
  feeUsd: number;
  fuseUsdc: number;
  coverPct: number;
}): number =>
  funding.state === 'arrived'
    ? estimateFundingCoverUsd({
        feeUsd,
        fuseUsdc,
        coverPct,
        sentUsd: Number(funding.swap.fromAmountUsd),
        receivedUsd: Number(funding.swap.toAmount),
      })
    : 0;

/**
 * Whether the cash route can go ahead with `token` right now.
 *
 * USDC on Fuse pays when it covers the fee, counting what an arrived bridge
 * payment earns. Anything else pays when it is worth the missing part: that is
 * what gets sent, and the bridge's cost comes out of the cover, not the user.
 */
export const canPayCashWith = ({
  token,
  billingTokenAddress,
  feeUsd,
  fuseUsdc,
  coverUsd,
}: {
  token: TokenBalance;
  billingTokenAddress: string;
  feeUsd: number;
  fuseUsdc: number;
  coverUsd: number;
}): boolean => {
  if (!(feeUsd > 0)) return false;
  if (isBillingToken(token, billingTokenAddress)) {
    return covers(Math.max(0, fuseUsdc) + coverUsd, feeUsd);
  }
  const need = fundingNeedUsd(feeUsd, fuseUsdc);
  return need > 0 && covers(tokenUsd(token), need);
};

/**
 * What the cash route opens on when the user has not picked a token.
 *
 * USDC on Fuse whenever it already covers the fee, or a bridged payment for it
 * is on its way or has landed — the user has nothing more to send. Otherwise
 * the richest holding that covers what is missing, which is the "show me my
 * USDC on Base" case. Failing both, USDC on Fuse again, so the row says what
 * the user needs rather than pointing at a token that cannot pay.
 */
export const defaultCashToken = ({
  rows,
  billingTokenAddress,
  feeUsd,
  fuseUsdc,
  funding,
}: {
  rows: TokenBalance[];
  billingTokenAddress: string;
  feeUsd: number;
  fuseUsdc: number;
  funding: UpgradeFunding;
}): TokenBalance | undefined => {
  const billing = rows.find(row => isBillingToken(row, billingTokenAddress));
  if (covers(fuseUsdc, feeUsd) || funding.state === 'pending' || funding.state === 'arrived') {
    return billing;
  }
  const need = fundingNeedUsd(feeUsd, fuseUsdc);
  const payer = rows
    .filter(row => !isBillingToken(row, billingTokenAddress) && covers(tokenUsd(row), need))
    .sort((a, b) => tokenUsd(b) - tokenUsd(a))[0];
  return payer ?? billing;
};
