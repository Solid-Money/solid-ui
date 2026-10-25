import { getJWTToken, getPlatformHeaders } from '@/lib/api';
import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';

import type {
  AiApiBilling,
  AiApiKey,
  AiApiOverview,
  CreateAiApiKeyResponse,
} from '@/lib/types/ai-api';

const endpoint = (path: string) => `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/ai-api${path}`;

const headers = () => {
  const jwt = getJWTToken();
  return {
    'Content-Type': 'application/json',
    ...getPlatformHeaders(),
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
};

const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(endpoint(path), {
    method,
    headers: headers(),
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw response;
  if (response.status === 204) return undefined as T;
  return response.json();
};

export const fetchAiApiOverview = (): Promise<AiApiOverview> => request('GET', '');

export const createAiApiKey = (input: {
  name: string;
  monthlyLimitUsd: number;
}): Promise<CreateAiApiKeyResponse> => request('POST', '/keys', input);

export const updateAiApiKey = (
  id: string,
  input: { name?: string; monthlyLimitUsd?: number },
): Promise<AiApiKey> => request('PATCH', `/keys/${encodeURIComponent(id)}`, input);

export const deleteAiApiKey = (id: string): Promise<void> =>
  request('DELETE', `/keys/${encodeURIComponent(id)}`);

export const confirmAiApiBilling = (input: { transactionHash?: string }): Promise<AiApiBilling> =>
  request('POST', '/billing/confirm', input);

export const retryAiApiBilling = (): Promise<{ charged: boolean; paused: boolean }> =>
  request('POST', '/billing/retry');

/**
 * The base URL agents are pointed at, without `/v1`.
 *
 * The backend names a friendlier host once the ingress routes one; until then
 * the proxy lives on the API host itself, under `/accounts/v1/ai`.
 */
export const aiApiBaseUrl = (overview?: Pick<AiApiOverview, 'baseUrl'> | null): string =>
  (overview?.baseUrl ?? `${EXPO_PUBLIC_FLASH_API_BASE_URL}/accounts/v1/ai`).replace(/\/+$/, '');

/** The model the setup lines name: the configured default, else the first one offered. */
export const aiApiSetupModel = (
  overview?: Pick<AiApiOverview, 'defaultModel' | 'models'> | null,
): string => overview?.defaultModel ?? overview?.models[0]?.id ?? '<model>';
