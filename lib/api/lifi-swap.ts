import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { LifiRouteOrder, LifiSwapQuote, LifiSwapStatus } from '@/lib/types/lifi-swap';

/**
 * Cross-chain and non-Fuse swaps. Every call goes through our backend, which
 * holds the LI.FI key and fixes sender and recipient to the user's own Safe.
 */
const BASE = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/lifi-swap`;

const authHeaders = () => {
  const jwt = getJWTToken();
  return {
    'Content-Type': 'application/json',
    ...getPlatformHeaders(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
};

/** Carries the backend's own message (no route, busy, unlisted token) to the form. */
export class LifiSwapApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'LifiSwapApiError';
    this.status = status;
  }
}

const parse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `Request failed (${response.status})`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body?.message)) message = body.message.join(', ');
    else if (typeof body?.message === 'string') message = body.message;
  } catch {
    // Keep the generic message.
  }
  // 401 must still reach `withRefreshToken`, which looks at `response.status`.
  if (response.status === 401) throw response;
  throw new LifiSwapApiError(response.status, message);
};

export const fetchLifiSwapQuote = async (
  params: {
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    slippage?: number;
    order?: LifiRouteOrder;
  },
  signal?: AbortSignal,
): Promise<LifiSwapQuote> => {
  const query = new URLSearchParams({
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
    fromToken: params.fromToken,
    toToken: params.toToken,
    fromAmount: params.fromAmount,
    ...(params.slippage !== undefined ? { slippage: String(params.slippage) } : {}),
    ...(params.order ? { order: params.order } : {}),
  });
  const response = await fetch(`${BASE}/quote?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    signal,
  });
  return parse<LifiSwapQuote>(response);
};

export const fetchLifiSwapStatus = async (params: {
  txHash: string;
  fromChain: number;
  toChain: number;
}): Promise<LifiSwapStatus> => {
  const query = new URLSearchParams({
    txHash: params.txHash,
    fromChain: String(params.fromChain),
    toChain: String(params.toChain),
  });
  const response = await fetch(`${BASE}/status?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  return parse<LifiSwapStatus>(response);
};

/** Books the Solid fee from the mined transaction. Idempotent; the backend reads the fee on-chain. */
export const recordLifiSwapFee = async (body: {
  chainId: number;
  transactionHash: string;
  fromAmount: string;
}): Promise<{ recorded: boolean; feeAmountUsd: string }> => {
  const response = await fetch(`${BASE}/fees`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parse(response);
};
