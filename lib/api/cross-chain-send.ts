import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import {
  CrossChainSendAuthoriseRequest,
  CrossChainSendAuthoriseResponse,
  CrossChainSendConfig,
  CrossChainSendQuote,
  CrossChainSendRecord,
  CrossChainSendToken,
} from '@/lib/types/cross-chain-send';

const BASE = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/cross-chain-sends`;

const authHeaders = () => {
  const jwt = getJWTToken();
  return {
    'Content-Type': 'application/json',
    ...getPlatformHeaders(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
};

/**
 * Read the body of a failed response so the caller can show the backend's own
 * message (limits, paused feature, route credit) instead of a bare status code.
 */
export class CrossChainSendApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'CrossChainSendApiError';
    this.status = status;
    this.code = code;
  }
}

const parse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `Request failed (${response.status})`;
  let code: string | undefined;
  try {
    const body = (await response.json()) as { message?: string | string[]; code?: string };
    if (Array.isArray(body?.message)) message = body.message.join(', ');
    else if (typeof body?.message === 'string') message = body.message;
    code = body?.code;
  } catch {
    // Keep the generic message.
  }
  // 401 must still reach `withRefreshToken`, which looks at `response.status`.
  if (response.status === 401) throw response;
  throw new CrossChainSendApiError(response.status, message, code);
};

export const fetchCrossChainSendConfig = async (): Promise<CrossChainSendConfig> => {
  const response = await fetch(`${BASE}/config`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  return parse<CrossChainSendConfig>(response);
};

export const fetchCrossChainSendQuote = async (params: {
  token: CrossChainSendToken;
  dstChainId: number;
  amountLD: string;
}): Promise<CrossChainSendQuote> => {
  const query = new URLSearchParams({
    token: params.token,
    dstChainId: String(params.dstChainId),
    amountLD: params.amountLD,
  });
  const response = await fetch(`${BASE}/quote?${query.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  return parse<CrossChainSendQuote>(response);
};

export const authoriseCrossChainSend = async (
  body: CrossChainSendAuthoriseRequest,
): Promise<CrossChainSendAuthoriseResponse> => {
  const response = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(body),
  });
  return parse<CrossChainSendAuthoriseResponse>(response);
};

export const fetchCrossChainSend = async (sendId: string): Promise<CrossChainSendRecord> => {
  const response = await fetch(`${BASE}/${encodeURIComponent(sendId)}`, {
    method: 'GET',
    headers: authHeaders(),
    credentials: 'include',
  });
  return parse<CrossChainSendRecord>(response);
};
