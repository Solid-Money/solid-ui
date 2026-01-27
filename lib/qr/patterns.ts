/**
 * QR Code Detection Patterns and Parsing
 *
 * Contains regex patterns and parsing logic for detecting
 * and extracting data from various QR code formats.
 */

import { isAddress } from 'viem';

import {
  QRCodeType,
  QREIP681URI,
  QRENSName,
  QREthereumAddress,
  QRParsedData,
  QRScannerMode,
  QRSolidProfile,
  QRUnknown,
  QRWalletConnectV2,
} from './types';

/**
 * Regex patterns for detecting QR code types
 */
export const QR_PATTERNS = {
  /** Ethereum address: 0x followed by 40 hex characters */
  ETHEREUM_ADDRESS: /^0x[a-fA-F0-9]{40}$/,

  /** EIP-681 URI: ethereum:0x... with optional parameters */
  EIP_681_URI: /^ethereum:(0x[a-fA-F0-9]{40})(?:@(\d+))?(?:\/([^?]+))?(?:\?(.+))?$/i,

  /** WalletConnect v2: wc:topic@2?symKey=...&relay-protocol=... */
  WALLET_CONNECT_V2: /^wc:([a-f0-9]+)@2\?(.+)$/i,

  /** ENS name: alphanumeric with dots, ending in .eth */
  ENS_NAME: /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.eth$/,

  /** Solid profile URL */
  SOLID_PROFILE: /^(?:https?:\/\/)?(?:www\.)?solid\.xyz\/profile\/([a-zA-Z0-9_-]+)/i,
} as const;

/**
 * QR types allowed for each scanner mode
 */
const MODE_ALLOWED_TYPES: Record<QRScannerMode, QRCodeType[]> = {
  send: [QRCodeType.ETHEREUM_ADDRESS, QRCodeType.EIP_681_URI, QRCodeType.ENS_NAME],
  connect: [QRCodeType.WALLET_CONNECT_V2],
  all: Object.values(QRCodeType).filter(t => t !== QRCodeType.UNKNOWN),
};

/**
 * Detects the type of QR code from raw data
 */
export function detectQRType(data: string): QRCodeType {
  const trimmed = data.trim();

  // Check WalletConnect first (most specific pattern)
  if (QR_PATTERNS.WALLET_CONNECT_V2.test(trimmed)) {
    return QRCodeType.WALLET_CONNECT_V2;
  }

  // Check EIP-681 URI (before plain address check)
  if (trimmed.toLowerCase().startsWith('ethereum:')) {
    return QRCodeType.EIP_681_URI;
  }

  // Check plain Ethereum address
  if (QR_PATTERNS.ETHEREUM_ADDRESS.test(trimmed) && isAddress(trimmed)) {
    return QRCodeType.ETHEREUM_ADDRESS;
  }

  // Check ENS name
  if (QR_PATTERNS.ENS_NAME.test(trimmed)) {
    return QRCodeType.ENS_NAME;
  }

  // Check Solid profile
  if (QR_PATTERNS.SOLID_PROFILE.test(trimmed)) {
    return QRCodeType.SOLID_PROFILE;
  }

  // Try to extract an address from anywhere in the string
  const addressMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
  if (addressMatch && isAddress(addressMatch[0])) {
    return QRCodeType.ETHEREUM_ADDRESS;
  }

  return QRCodeType.UNKNOWN;
}

/**
 * Checks if a QR type is allowed for the given scanner mode
 */
export function isTypeAllowedForMode(type: QRCodeType, mode: QRScannerMode): boolean {
  return MODE_ALLOWED_TYPES[mode].includes(type);
}

/**
 * Parses EIP-681 URI parameters
 */
function parseEIP681Params(paramString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = paramString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    }
  }

  return params;
}

/**
 * Parses WalletConnect v2 URI parameters
 */
function parseWCParams(paramString: string): { symKey?: string; relay?: string } {
  const params = parseEIP681Params(paramString);
  return {
    symKey: params.symKey,
    relay: params['relay-protocol'],
  };
}

/**
 * Parses raw QR data into structured format based on detected type
 */
export function parseQRData(data: string): QRParsedData {
  const trimmed = data.trim();
  const type = detectQRType(trimmed);

  switch (type) {
    case QRCodeType.ETHEREUM_ADDRESS: {
      // Extract address (might be embedded in other text)
      const match = trimmed.match(/0x[a-fA-F0-9]{40}/);
      const address = match?.[0] || trimmed;

      return {
        type: QRCodeType.ETHEREUM_ADDRESS,
        raw: trimmed,
        address,
      } satisfies QREthereumAddress;
    }

    case QRCodeType.EIP_681_URI: {
      const match = trimmed.match(QR_PATTERNS.EIP_681_URI);
      if (!match) {
        // Fallback: try to extract just the address
        const addrMatch = trimmed.match(/0x[a-fA-F0-9]{40}/);
        return {
          type: QRCodeType.EIP_681_URI,
          raw: trimmed,
          address: addrMatch?.[0] || '',
        } satisfies QREIP681URI;
      }

      const [, address, chainIdStr, functionName, paramString] = match;
      const parameters = paramString ? parseEIP681Params(paramString) : undefined;

      return {
        type: QRCodeType.EIP_681_URI,
        raw: trimmed,
        address,
        chainId: chainIdStr ? parseInt(chainIdStr, 10) : undefined,
        functionName,
        value: parameters?.value,
        gasLimit: parameters?.gasLimit || parameters?.gas,
        gasPrice: parameters?.gasPrice,
        parameters,
      } satisfies QREIP681URI;
    }

    case QRCodeType.WALLET_CONNECT_V2: {
      const match = trimmed.match(QR_PATTERNS.WALLET_CONNECT_V2);
      if (!match) {
        return { type: QRCodeType.UNKNOWN, raw: trimmed } satisfies QRUnknown;
      }

      const [, topic, paramString] = match;
      const { symKey, relay } = parseWCParams(paramString);

      return {
        type: QRCodeType.WALLET_CONNECT_V2,
        raw: trimmed,
        topic,
        symKey: symKey || '',
        relay,
      } satisfies QRWalletConnectV2;
    }

    case QRCodeType.ENS_NAME: {
      return {
        type: QRCodeType.ENS_NAME,
        raw: trimmed,
        name: trimmed.toLowerCase(),
      } satisfies QRENSName;
    }

    case QRCodeType.SOLID_PROFILE: {
      const match = trimmed.match(QR_PATTERNS.SOLID_PROFILE);
      return {
        type: QRCodeType.SOLID_PROFILE,
        raw: trimmed,
        profileId: match?.[1] || '',
      } satisfies QRSolidProfile;
    }

    default:
      return { type: QRCodeType.UNKNOWN, raw: trimmed } satisfies QRUnknown;
  }
}

/**
 * Extracts an Ethereum address from various QR code formats.
 * Utility function for backward compatibility with existing code.
 *
 * @returns The extracted address or null if not found
 */
export function extractAddress(data: string): string | null {
  const parsed = parseQRData(data);

  switch (parsed.type) {
    case QRCodeType.ETHEREUM_ADDRESS:
      return parsed.address;
    case QRCodeType.EIP_681_URI:
      return parsed.address || null;
    default:
      return null;
  }
}
