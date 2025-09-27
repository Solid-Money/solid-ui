import { ClientNonceData } from '@/lib/types';

/**
 * Generate client nonce from secret and timestamp
 * This follows the Bridge API specification for secure card details reveal
 */
export const generateClientNonce = async (
  clientSecret: string,
  clientTimestamp: number,
): Promise<string> => {
  const message = `nonce:${clientTimestamp}`;

  // Convert secret and message to ArrayBuffer
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
