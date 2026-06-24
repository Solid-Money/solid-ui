import { encodeFunctionData, erc20Abi, maxUint256, parseUnits } from 'viem';

export const COW_API_BASE = 'https://api.cow.fi/mainnet/api/v1';
export const COW_BFF_BASE = 'https://bff.cow.fi/1';

// Same address on all chains
export const COW_SETTLEMENT_CONTRACT = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' as const;
// VaultRelayer is what actually pulls tokens — this is what needs the ERC-20 allowance
export const COW_VAULT_RELAYER = '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110' as const;

// USDC on Ethereum mainnet (6 decimals)
export const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;
export const USDC_DECIMALS = 6;

// Backed Finance tokenized stock tokens use 18 decimals
export const STOCK_TOKEN_DECIMALS = 18;

// CoW Protocol app data (identifies this integration)
const APP_DATA = '0x0000000000000000000000000000000000000000000000000000000000000000';

const SET_PRE_SIGNATURE_ABI = [
  {
    inputs: [
      { internalType: 'bytes', name: 'orderUid', type: 'bytes' },
      { internalType: 'bool', name: 'signed', type: 'bool' },
    ],
    name: 'setPreSignature',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type CowOrderKind = 'sell' | 'buy';

export type CowOrderStatus = 'presignaturePending' | 'open' | 'fulfilled' | 'cancelled' | 'expired';

export type CowOrderParams = {
  sellToken: string;
  buyToken: string;
  receiver: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: string;
  partiallyFillable: boolean;
  sellTokenBalance: string;
  buyTokenBalance: string;
};

export type CowQuoteResponse = {
  quote: CowOrderParams;
  from: string;
  expiration: string;
  id: number;
  verified: boolean;
};

// ─── API functions ────────────────────────────────────────────────────────────

export async function cowGetQuote(params: {
  sellToken: string;
  buyToken: string;
  from: string;
  kind: CowOrderKind;
  sellAmountBeforeFee: string;
}): Promise<CowQuoteResponse> {
  const body = {
    sellToken: params.sellToken,
    buyToken: params.buyToken,
    from: params.from,
    kind: params.kind,
    sellAmountBeforeFee: params.sellAmountBeforeFee,
    signingScheme: 'presign',
    appData: APP_DATA,
    validFor: 600,
  };

  const res = await fetch(`${COW_API_BASE}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).description ?? `CoW quote failed (${res.status})`);
  }

  return res.json();
}

export async function cowSubmitPresignOrder(
  quote: CowQuoteResponse,
  fromAddress: string,
  slippageBps: number = 100,
): Promise<{ uid: string; sellAmount: string }> {
  // Explicitly build the order body — do not spread quote.quote as it contains
  // extra fields (gasAmount, gasPrice, sellTokenPrice) that the orders API rejects.
  //
  // CoW Protocol CIP-56: feeAmount must be "0" (fee is taken from trade surplus).
  // The quote returns sellAmount already reduced by the fee, so we add it back so
  // the user pays the full intended amount (sellAmount + feeAmount = sellAmountBeforeFee).
  const fullSellAmount = (
    BigInt(quote.quote.sellAmount) + BigInt(quote.quote.feeAmount)
  ).toString();

  // Apply dynamic slippage tolerance: order.buyAmount is the *minimum* the user will receive.
  // Submitting quote.buyAmount verbatim means any tiny price move causes solvers to skip
  // the order entirely — especially problematic for illiquid xstock tokens.
  const slipBps = BigInt(Math.round(slippageBps));
  const minBuyAmount = (
    (BigInt(quote.quote.buyAmount) * (10_000n - slipBps)) /
    10_000n
  ).toString();

  const body = {
    sellToken: quote.quote.sellToken,
    buyToken: quote.quote.buyToken,
    receiver: quote.quote.receiver || fromAddress,
    sellAmount: fullSellAmount,
    buyAmount: minBuyAmount,
    validTo: quote.quote.validTo,
    appData: quote.quote.appData,
    feeAmount: '0',
    kind: quote.quote.kind,
    partiallyFillable: quote.quote.partiallyFillable,
    sellTokenBalance: quote.quote.sellTokenBalance,
    buyTokenBalance: quote.quote.buyTokenBalance,
    signingScheme: 'presign',
    signature: '0x',
    from: fromAddress,
    quoteId: quote.id,
  };

  const res = await fetch(`${COW_API_BASE}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).description ?? `CoW order submission failed (${res.status})`);
  }

  // API returns a quoted string like "\"0xabcd...\""
  const uid: string = await res.json();
  return { uid, sellAmount: fullSellAmount };
}

/** Fetch USD price for a token via CoW BFF. Returns null on failure. */
export async function cowGetTokenUsdPrice(tokenAddress: string): Promise<number | null> {
  try {
    const res = await fetch(`${COW_BFF_BASE}/tokens/${tokenAddress}/usdPrice`);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.price === 'number' ? data.price : null;
  } catch {
    return null;
  }
}

/** Fetch dynamic slippage tolerance for a market pair via CoW BFF. Returns bps (e.g. 55 = 0.55%). */
export async function cowGetSlippageTolerance(
  sellToken: string,
  buyToken: string,
): Promise<number> {
  try {
    const res = await fetch(
      `${COW_BFF_BASE}/markets/${sellToken}-${buyToken}/slippageTolerance`,
    );
    if (!res.ok) return 100; // fallback 1%
    const data = await res.json();
    return typeof data.slippageBps === 'number' ? data.slippageBps : 100;
  } catch {
    return 100; // fallback 1%
  }
}

export async function cowGetOrder(uid: string): Promise<{
  status: CowOrderStatus;
  executedBuyAmount: string;
  executedSellAmount: string;
  executedFeeAmount: string;
}> {
  const res = await fetch(`${COW_API_BASE}/orders/${uid}`);
  if (!res.ok) throw new Error(`Failed to get order (${res.status})`);

  const order = await res.json();
  return {
    status: order.status,
    executedBuyAmount: order.executedBuyAmount ?? '0',
    executedSellAmount: order.executedSellAmount ?? '0',
    executedFeeAmount: order.executedFeeAmount ?? '0',
  };
}

// ─── Transaction builders ─────────────────────────────────────────────────────

/**
 * Build the two on-chain transactions needed for a CoW presign order:
 * 1. ERC-20 approve: grant settlement contract allowance for the sell amount
 * 2. setPreSignature: mark the order as signed by the owner (Safe)
 */
export function buildPresignTransactions(
  orderUid: string,
  sellToken: string,
  sellAmount: string,
): { to: `0x${string}`; data: `0x${string}`; value: bigint }[] {
  const approveData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [COW_VAULT_RELAYER, maxUint256],
  });

  const presignData = encodeFunctionData({
    abi: SET_PRE_SIGNATURE_ABI,
    functionName: 'setPreSignature',
    args: [orderUid as `0x${string}`, true],
  });

  return [
    { to: sellToken as `0x${string}`, data: approveData, value: 0n },
    { to: COW_SETTLEMENT_CONTRACT, data: presignData, value: 0n },
  ];
}

// ─── Amount helpers ───────────────────────────────────────────────────────────

/** USD string → USDC atoms (6 decimals) */
export function usdToUsdcAtoms(usdAmount: string): string {
  const n = parseFloat(usdAmount);
  if (!n || n <= 0) return '0';
  return parseUnits(n.toFixed(6), USDC_DECIMALS).toString();
}

/** Shares string → stock token atoms (18 decimals) */
export function sharesToAtoms(shares: number): string {
  if (!shares || shares <= 0) return '0';
  return parseUnits(shares.toFixed(6), STOCK_TOKEN_DECIMALS).toString();
}

/** Stock token atoms → shares (18 decimals) */
export function atomsToShares(atoms: string): number {
  return Number(BigInt(atoms)) / 1e18;
}

/** USDC atoms → USD display value */
export function usdcAtomsToUsd(atoms: string): number {
  return Number(BigInt(atoms)) / 1e6;
}
