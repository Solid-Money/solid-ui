import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import {
  LifiRouteOrder,
  LifiSwapDestinations,
  LifiSwapQuote,
  LifiSwapStatus,
} from '@/lib/types/lifi-swap';

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

/**
 * A refused request. `code` says why (see `lib/swapErrors`), and is what the
 * form shows copy for; `message` is the backend's English, kept for logs.
 * `details` carries what goes with the code, e.g. `minFromAmount`.
 */
export class LifiSwapApiError extends Error {
  status: number;
  code: string | undefined;
  details: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    code?: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'LifiSwapApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const parse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `Request failed (${response.status})`;
  let code: string | undefined;
  let details: Record<string, unknown> = {};
  try {
    const body = (await response.json()) as {
      message?: string | string[];
      code?: unknown;
    } & Record<string, unknown>;
    if (Array.isArray(body?.message)) message = body.message.join(', ');
    else if (typeof body?.message === 'string') message = body.message;
    if (typeof body?.code === 'string') code = body.code;
    const { message: _message, code: _code, statusCode: _status, ...rest } = body ?? {};
    details = rest;
  } catch {
    // Keep the generic message.
  }
  // 401 must still reach `withRefreshToken`, which looks at `response.status`.
  if (response.status === 401) throw response;
  throw new LifiSwapApiError(response.status, message, code, details);
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

/**
 * What a "You pay" token can be swapped into: the swap list narrowed to what
 * has a route, with each pair's minimum. Cached by the backend.
 */
export const fetchLifiSwapDestinations = async (
  params: { fromChain: number; fromToken: string },
  signal?: AbortSignal,
): Promise<LifiSwapDestinations> => {
  const query = new URLSearchParams({
    fromChain: String(params.fromChain),
    fromToken: params.fromToken,
  });
  const response = await fetch(`${BASE}/destinations?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
    signal,
  });
  return parse<LifiSwapDestinations>(response);
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
