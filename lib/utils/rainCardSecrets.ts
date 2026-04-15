import { Platform } from 'react-native';

/**
 * Rain card reveal: generate SessionId for POST /cards/secrets.
 * Secret = 32-char hex; encrypt secret (as base64) with Rain RSA-OAEP (SHA-1) public key.
 * Returns { secretKey } for later AES-GCM decrypt and { sessionId } to send in header.
 */
export async function generateSessionId(
  pem: string,
  secret?: string,
): Promise<{ secretKey: string; sessionId: string }> {
  if (!pem) throw new Error('pem is required');
  const secretKey =
    secret ?? (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '')
      : generateHex32());
  if (!/^[0-9A-Fa-f]{32}$/.test(secretKey)) throw new Error('secret must be 32-char hex');

  const hexBytes = secretKey.match(/.{2}/g)!.map(b => parseInt(b, 16));
  const secretKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(hexBytes)));

  if (Platform.OS !== 'web') {
    const nodeCrypto = require('crypto');
    const sessionId = nodeCrypto
      .publicEncrypt(
        {
          key: pem,
          padding: nodeCrypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha1',
        },
        Buffer.from(secretKeyBase64, 'utf-8'),
      )
      .toString('base64');
    return { secretKey, sessionId };
  }

  const pemContents = pem.replace(
    /-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,
    '',
  );
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const rsaPublicKey = await crypto.subtle.importKey(
    'spki',
    binaryDer,
    { name: 'RSA-OAEP', hash: 'SHA-1' },
    true,
    ['encrypt'],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    rsaPublicKey,
    new TextEncoder().encode(secretKeyBase64),
  );
  const sessionId = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return { secretKey, sessionId };
}

/**
 * Rain card reveal: AES-128-GCM decrypt of encryptedPan/encryptedCvc.
 * secretKey = 32-char hex from generateSessionId; base64Data and base64Iv from response.
 */
export async function decryptSecret(
  base64Data: string,
  base64Iv: string,
  secretKey: string,
): Promise<string> {
  if (!/^[0-9A-Fa-f]{32}$/.test(secretKey))
    throw new Error('secretKey must be 32-char hex');

  const data = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(base64Iv), c => c.charCodeAt(0));
  const keyBytes = new Uint8Array(
    secretKey.match(/.{2}/g)!.map(b => parseInt(b, 16)),
  );

  if (Platform.OS !== 'web') {
    const nodeCrypto = require('crypto');
    const authTagLength = 16;
    const tag = data.slice(-authTagLength);
    const ciphertext = data.slice(0, -authTagLength);
    const decipher = nodeCrypto.createDecipheriv(
      'aes-128-gcm',
      Buffer.from(keyBytes),
      Buffer.from(iv),
      { authTagLength },
    );
    decipher.setAuthTag(Buffer.from(tag));
    const dec = decipher.update(Buffer.from(ciphertext)) as Buffer;
    const final = decipher.final() as Buffer;
    return Buffer.concat([dec, final]).toString('utf-8');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data,
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Rain card PIN: AES-128-GCM encrypt a PIN for submission.
 * Formats PIN as PIN block: 2[length_hex][PIN][F padding] per Rain spec.
 * secretKey = 32-char hex from generateSessionId.
 * Returns { encryptedPin, encodedIv } as base64 strings.
 */
export async function encryptPin(
  pin: string,
  secretKey: string,
): Promise<{ encryptedPin: string; encodedIv: string }> {
  if (!/^[0-9A-Fa-f]{32}$/.test(secretKey))
    throw new Error('secretKey must be 32-char hex');

  // Format PIN as PIN block: 2[length_hex][PIN][F padding to 16 chars total]
  const formattedPin = `2${pin.length.toString(16)}${pin}${'F'.repeat(14 - pin.length)}`;

  const keyBytes = new Uint8Array(
    secretKey.match(/.{2}/g)!.map(b => parseInt(b, 16)),
  );

  if (Platform.OS !== 'web') {
    const nodeCrypto = require('crypto');
    const iv = nodeCrypto.randomBytes(16);
    const cipher = nodeCrypto.createCipheriv(
      'aes-128-gcm',
      Buffer.from(keyBytes),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(formattedPin, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const encryptedWithAuthTag = Buffer.concat([encrypted, authTag]);
    return {
      encryptedPin: encryptedWithAuthTag.toString('base64'),
      encodedIv: iv.toString('base64'),
    };
  }

  // Web: use SubtleCrypto
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    new TextEncoder().encode(formattedPin),
  );
  return {
    encryptedPin: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    encodedIv: btoa(String.fromCharCode(...iv)),
  };
}

/**
 * Decrypt a PIN from Rain's encrypted response.
 * Extracts the PIN from the PIN block format: 2[length_hex][PIN][F padding].
 */
export async function decryptPin(
  base64Data: string,
  base64Iv: string,
  secretKey: string,
): Promise<string> {
  const decrypted = await decryptSecret(base64Data, base64Iv, secretKey);
  // PIN block format: 2[length_hex][PIN][F padding]
  // Extract PIN: skip first char '2', read length from hex char at index 1, then extract PIN
  const pinLength = parseInt(decrypted[1], 16);
  return decrypted.substring(2, 2 + pinLength);
}

function generateHex32(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
