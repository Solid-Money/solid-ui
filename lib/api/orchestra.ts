import { randomUUID } from 'expo-crypto';

import {
  EXPO_PUBLIC_ORCHESTRA_API_BASE_URL,
  EXPO_PUBLIC_ORCHESTRA_CLIENT_KEY,
  EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET,
  EXPO_PUBLIC_ORCHESTRA_DESTINATION_CHAIN,
} from '@/lib/config';
import { ORCHESTRA_ERROR_CODE, OrchestraError, toOrchestraError } from '@/lib/orchestraErrors';

import type {
  OrchestraEstimate,
  OrchestraLimitsResponse,
  OrchestraOnrampOrder,
  OrchestraOnrampRequest,
  OrchestraRoutesResponse,
  OrchestraStatusResponse,
} from '@/lib/types/orchestra';

/**
 * Flashnet Orchestra's Lightning onramp, called straight from the app.
 *
 * Every request here authenticates with the *client* key (`fnp_...`), whose
 * scopes — orders:onramp, orders:read, orders:sse — are exactly this flow and
 * nothing else. The server key never appears in this file or anywhere else in
 * the bundle; see the note in lib/config.ts.
 *
 * Reads are doubly gated: the client key proves which partner is asking, and an
 * order-bound `readToken` from the /onramp response proves which order it may
 * see. The token expires after 24 hours, which outlives an exact-in invoice's
 * own 24-hour window only just — an order resumed late in the recovery window
 * can outlive its token, and the status read 403s with `invalid_read_token`
 * rather than returning a stale state.
 *
 * Docs: https://docs.flashnet.xyz/orchestra/onramp
 */

const LIGHTNING_SOURCE = { sourceChain: 'lightning', sourceAsset: 'BTC' } as const;

const baseUrl = () => EXPO_PUBLIC_ORCHESTRA_API_BASE_URL.replace(/\/+$/, '');

/**
 * Orchestra's own auth, not the app's. `getJWTToken` is deliberately not used:
 * this host is a third party and has no business seeing a Solid session token.
 */
const authHeaders = () => {
  if (!EXPO_PUBLIC_ORCHESTRA_CLIENT_KEY) {
    throw new OrchestraError(
      ORCHESTRA_ERROR_CODE.NOT_CONFIGURED,
      'none',
      'This deposit method isn’t available yet.',
      0,
      'EXPO_PUBLIC_ORCHESTRA_CLIENT_KEY is not set',
    );
  }
  return { Authorization: `Bearer ${EXPO_PUBLIC_ORCHESTRA_CLIENT_KEY}` };
};

/** The app's configured destination, as the `<chain>:<asset>` pair the API takes. */
export const orchestraDestination = () => ({
  destinationChain: EXPO_PUBLIC_ORCHESTRA_DESTINATION_CHAIN,
  destinationAsset: EXPO_PUBLIC_ORCHESTRA_DESTINATION_ASSET,
});

/**
 * Indicative pricing. Stateless, allocates no invoice, and needs no key — so it
 * is safe to call on every settled keystroke while the user picks an amount.
 */
export const getOrchestraEstimate = async (
  amountFiatUsd: string,
  signal?: AbortSignal,
): Promise<OrchestraEstimate> => {
  const params = new URLSearchParams({
    ...LIGHTNING_SOURCE,
    ...orchestraDestination(),
    amountFiatUsd,
  });

  const response = await fetch(`${baseUrl()}/v1/orchestration/estimate?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * Asset capabilities and — the reason this flow calls it — the destination's
 * decimals. Two assets sharing a ticker on different chains have different
 * exponents, so the only correct source for one is this response.
 */
export const getOrchestraRoutes = async (
  signal?: AbortSignal,
): Promise<OrchestraRoutesResponse> => {
  const response = await fetch(`${baseUrl()}/v2/orchestration/routes`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * Amount bounds for the Lightning → destination route.
 *
 * A guardrail for the form, not an execution guarantee: /onramp can still
 * refuse an amount inside the published band when live pricing disagrees.
 */
export const getOrchestraLimits = async (
  signal?: AbortSignal,
): Promise<OrchestraLimitsResponse> => {
  const params = new URLSearchParams({ ...LIGHTNING_SOURCE, ...orchestraDestination() });

  const response = await fetch(`${baseUrl()}/v1/orchestration/limits?${params}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * Create the order and its invoice.
 *
 * The idempotency key is generated per call rather than per amount: react-query
 * does not retry this mutation, and reusing a key across two deliberate
 * attempts would return the first attempt's expired invoice instead of a fresh
 * one. Retrying *this* request — same body, same key — is what the header is
 * for, and that is the caller's to arrange.
 */
export const createOrchestraOnramp = async (
  request: Omit<OrchestraOnrampRequest, 'destinationChain' | 'destinationAsset'>,
  idempotencyKey: string = randomUUID(),
): Promise<OrchestraOnrampOrder> => {
  const response = await fetch(`${baseUrl()}/v1/orchestration/onramp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Idempotency-Key': idempotencyKey,
      ...authHeaders(),
    },
    body: JSON.stringify({ ...orchestraDestination(), ...request }),
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * Current state of one order. Answers 404 `not_found` until the deposit lands
 * and the quote becomes an order, which the caller reads as "still waiting for
 * payment" rather than as a failure.
 */
export const getOrchestraStatus = async (
  orderId: string,
  readToken: string,
  signal?: AbortSignal,
): Promise<OrchestraStatusResponse> => {
  const params = new URLSearchParams({ id: orderId });

  const response = await fetch(`${baseUrl()}/v1/orchestration/status?${params}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-Read-Token': readToken,
      ...authHeaders(),
    },
    signal,
  });

  if (!response.ok) throw await toOrchestraError(response);
  return response.json();
};

/**
 * URL for the order's SSE stream.
 *
 * The key goes in `token` because EventSource cannot set headers, and direct
 * client streams accept `readToken` only as a query parameter. That does put
 * both in a URL — acceptable for a scoped, origin-pinned client key and a
 * 24-hour order-bound token, but it is why this must never be built with a
 * server key, and why the URL is not logged or handed to analytics.
 */
export const orchestraStreamUrl = (orderId: string, readToken: string): string => {
  const params = new URLSearchParams({
    token: EXPO_PUBLIC_ORCHESTRA_CLIENT_KEY,
    readToken,
  });
  return `${baseUrl()}/v1/sse/operations/${encodeURIComponent(orderId)}?${params}`;
};
