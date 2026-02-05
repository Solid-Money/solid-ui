import { Platform } from 'react-native';

import { ClientNonceData } from '@/lib/types';

/**
 * Generate client nonce from secret and timestamp using HMAC-SHA256.
 * This follows the Bridge API specification for secure card details reveal.
 *
 * Uses platform-appropriate HMAC implementation:
 * - Native (iOS/Android): react-native-quick-crypto's createHmac (subtle.sign is not implemented)
 * - Web: Web Crypto API (subtle.sign)
 */
export const generateClientNonce = async (
  clientSecret: string,
  clientTimestamp: number,
): Promise<string> => {
  const message = `nonce:${clientTimestamp}`;

  // On native platforms, use react-native-quick-crypto's createHmac
  // because subtle.sign('HMAC', ...) is not implemented in the polyfill
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require('crypto'); // Aliased to react-native-quick-crypto via metro.config.js
    const hmac = nodeCrypto.createHmac('sha256', clientSecret);
    hmac.update(message);
    const digestBuffer = hmac.digest();

    // Use same base64 encoding approach as web for consistency
    const bytes = new Uint8Array(digestBuffer);
    const result = btoa(String.fromCharCode(...bytes));
    return result;
  }

  // On web, use the standard Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(clientSecret);
  const messageData = encoder.encode(message);

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  // Sign the message
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

  // Convert to base64
  const signatureArray = new Uint8Array(signature);
  return btoa(String.fromCharCode(...signatureArray));
};

/**
 * Helper function to generate client secret, timestamp, and nonce
 */
export const generateClientNonceData = async (): Promise<ClientNonceData> => {
  // Generate random 32-byte secret
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const clientSecret = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

  // Generate current timestamp
  const clientTimestamp = Math.floor(Date.now() / 1000);

  // Generate nonce from secret and timestamp
  const nonce = await generateClientNonce(clientSecret, clientTimestamp);

  return {
    clientSecret,
    clientTimestamp,
    nonce,
  };
};
