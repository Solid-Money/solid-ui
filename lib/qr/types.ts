/**
 * QR Code Types and Interfaces
 *
 * Defines the various QR code formats supported by the scanner,
 * including Ethereum addresses, EIP-681 URIs, WalletConnect, and more.
 */

/**
 * Supported QR code types that can be detected and parsed
 */
export enum QRCodeType {
  /** Plain Ethereum address (0x...) */
  ETHEREUM_ADDRESS = 'ETHEREUM_ADDRESS',
  /** EIP-681 Payment URI (ethereum:0x...?value=...) */
  EIP_681_URI = 'EIP_681_URI',
  /** WalletConnect v2 pairing URI */
  WALLET_CONNECT_V2 = 'WALLET_CONNECT_V2',
  /** ENS domain name (*.eth) */
  ENS_NAME = 'ENS_NAME',
  /** Solid app profile link */
  SOLID_PROFILE = 'SOLID_PROFILE',
  /** Unrecognized QR code format */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Scanner modes that restrict which QR types are accepted
 */
export type QRScannerMode = 'send' | 'connect' | 'all';

/**
 * Base interface for all parsed QR data
 */
export interface QRDataBase {
  type: QRCodeType;
  raw: string;
}

/**
 * Parsed Ethereum address data
 */
export interface QREthereumAddress extends QRDataBase {
  type: QRCodeType.ETHEREUM_ADDRESS;
  address: string;
}

/**
 * Parsed EIP-681 URI data
 * @see https://eips.ethereum.org/EIPS/eip-681
 */
export interface QREIP681URI extends QRDataBase {
  type: QRCodeType.EIP_681_URI;
  address: string;
  chainId?: number;
  value?: string;
  gasLimit?: string;
  gasPrice?: string;
  functionName?: string;
  parameters?: Record<string, string>;
}

/**
 * Parsed WalletConnect v2 URI data
 */
export interface QRWalletConnectV2 extends QRDataBase {
  type: QRCodeType.WALLET_CONNECT_V2;
  topic: string;
  symKey: string;
  relay?: string;
}

/**
 * Parsed ENS name data
 */
export interface QRENSName extends QRDataBase {
  type: QRCodeType.ENS_NAME;
  name: string;
}

/**
 * Parsed Solid profile data
 */
export interface QRSolidProfile extends QRDataBase {
  type: QRCodeType.SOLID_PROFILE;
  profileId: string;
}

/**
 * Unknown QR code data
 */
export interface QRUnknown extends QRDataBase {
  type: QRCodeType.UNKNOWN;
}

/**
 * Union type of all possible parsed QR data
 */
export type QRParsedData =
  | QREthereumAddress
  | QREIP681URI
  | QRWalletConnectV2
  | QRENSName
  | QRSolidProfile
  | QRUnknown;

/**
 * Result of handling a scanned QR code
 */
export interface QRHandlerResult {
  success: boolean;
  message?: string;
  navigateTo?: string;
  data?: Record<string, unknown>;
}

/**
 * Configuration for the QR scanner screen
 */
export interface QRScannerConfig {
  mode: QRScannerMode;
  title?: string;
  helperText?: string;
  onSuccess?: (data: QRParsedData) => void;
  onError?: (error: string) => void;
}
