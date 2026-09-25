import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';
import { toOrchestraError } from '@/lib/orchestraErrors';

import type {
  OrchestraConfig,
  OrchestraOnrampOrder,
  OrchestraStatusResponse,
} from '@/lib/types/orchestra';

/**
 * Flashnet Orchestra's Lightning onramp, through our own backend.
 *
 * Nothing here talks to Orchestra directly. The accounts service holds the
 * Orchestra *server* key and proxies every call, which buys two things a
 * device-held client key cannot: the recipient address is resolved from the
 * session rather than sent in a body the user controls, and a status read is
 * checked against that address, so an order id is not enough to read someone
 * else's deposit.
 *
 * Backend: apps/flash-accounts-service/src/orchestra in solid-backend.
 */

const ORCHESTRA_BASE = `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/orchestra`;

const orchestraHeaders = () => {
  const jwt = getJWTToken();
  return {
    Accept: 'application/json',
    ...getPlatformHeaders(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
};

/**
 * Destination, its decimals, the live fiat band, and whether this account may
 * use the onramp — one call, because the amount screen cannot render without
 * all of it and three round trips to show one form is three chances to
 * half-render it.
 *
 * The country goes to the server rather than being judged here: the audience
 * rule is "supported region **or** allowlisted", and only the server knows the
 * second half. It has no geoip, so the first half has to be told to it.
 */
export const getOrchestraConfig = async (
  countryCode?: string,
  signal?: AbortSignal,
): Promise<OrchestraConfig> => {
  const query = countryCode ? `?${new URLSearchParams({ countryCode })}` : '';
  const response = await fetch(`${ORCHESTRA_BASE}/config${query}`, {
    method: 'GET',
    headers: orchestraHeaders(),
    credentials: 'include',
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * Create the order and its invoice.
 *
 * Only the amount is sent. The recipient is whatever Safe the authenticated
 * user owns, decided server-side — passing one from here would be a field the
 * server has to distrust anyway.
 */
export const createOrchestraOnramp = async (
  amountFiatUsd: string,
  countryCode?: string,
): Promise<OrchestraOnrampOrder> => {
  const response = await fetch(`${ORCHESTRA_BASE}/onramp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...orchestraHeaders() },
    credentials: 'include',
    body: JSON.stringify({ amountFiatUsd, ...(countryCode ? { countryCode } : {}) }),
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * One order's snapshot. Answers `{ order: null }` until the Lightning payment
 * is detected, which is most of the status screen's life — and, deliberately,
 * for an order that was never ours, so a guessed id tells the caller nothing.
 */
export const getOrchestraStatus = async (
  orderId: string,
  signal?: AbortSignal,
): Promise<OrchestraStatusResponse> => {
  const response = await fetch(`${ORCHESTRA_BASE}/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: orchestraHeaders(),
    credentials: 'include',
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * URL for the order's SSE stream on our backend.
 *
 * No token in the query: EventSource cannot set headers, but it can send
 * cookies with `withCredentials`, and web sessions are cookie-authenticated
 * here. Native has no EventSource at all and takes the polling path, so the
 * header-only JWT it uses is never needed for a stream.
 */
export const orchestraStreamUrl = (orderId: string): string =>
  `${ORCHESTRA_BASE}/orders/${encodeURIComponent(orderId)}/stream`;
