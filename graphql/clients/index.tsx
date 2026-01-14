import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

/**
 * Lazy-initialized Apollo clients for improved startup performance.
 *
 * Instead of creating clients at module import time (blocking),
 * clients are created on first access. This defers the work until
 * actually needed, improving FCP by ~100-200ms.
 */

// Singleton instances (created on first access)
let _infoClient: ReturnType<typeof createInfoClient> | null = null;
let _algebraInfoClient: ReturnType<typeof createAlgebraInfoClient> | null = null;

const createInfoClient = () =>
  new ApolloClient({
    link: new HttpLink({ uri: process.env.EXPO_PUBLIC_INFO_GRAPH }),
    cache: new InMemoryCache(),
  });

const createAlgebraInfoClient = () =>
  new ApolloClient({
    link: new HttpLink({ uri: process.env.EXPO_PUBLIC_ALGEBRA_INFO_GRAPH }),
    cache: new InMemoryCache(),
  });

/**
 * Get the info graph Apollo client.
 * Client is lazily created on first access.
 */
export const getInfoClient = () => {
  if (!_infoClient) {
    _infoClient = createInfoClient();
  }
  return _infoClient;
};

/**
 * Get the algebra info graph Apollo client.
 * Client is lazily created on first access.
 */
export const getAlgebraInfoClient = () => {
  if (!_algebraInfoClient) {
    _algebraInfoClient = createAlgebraInfoClient();
  }
  return _algebraInfoClient;
};
