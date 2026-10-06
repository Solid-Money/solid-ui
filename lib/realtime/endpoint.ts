import { EXPO_PUBLIC_FLASH_API_BASE_URL } from '@/lib/config';

/** Where accounts-service serves its realtime socket (`RealtimeGateway`). */
export const REALTIME_SOCKET_PATH = '/accounts/v1/socket.io';

export interface RealtimeEndpoint {
  /** Origin only. Socket.IO reads any path in the URL as a namespace. */
  url: string;
  /** Engine.IO path, including any path the API base URL is mounted under. */
  path: string;
}

/**
 * The socket's origin and path, from the API base URL every other request uses.
 * Null when there is no usable base URL — the app then simply runs without
 * live updates, as it did before.
 */
export function getRealtimeEndpoint(
  baseUrl: string = EXPO_PUBLIC_FLASH_API_BASE_URL,
): RealtimeEndpoint | null {
  if (!baseUrl) return null;
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const basePath = parsed.pathname.replace(/\/+$/, '');
    return { url: parsed.origin, path: `${basePath}${REALTIME_SOCKET_PATH}` };
  } catch {
    return null;
  }
}
