/**
 * Apple Wallet Push Provisioning Types
 */

export interface AppleWalletProvisionRequest {
  nonce: string;
  nonceSignature: string;
  certificates: [string, string]; // [leaf, subordinate]
}

export interface AppleWalletProvisionResponse {
  encrypted_pass_data: string;
  activation_data: string;
  ephemeral_public_key: string;
}

export interface AppleWalletConfig {
  network: 'VISA' | 'MASTERCARD';
  lastDigits: string;
  cardHolderName: string;
  cardDescription: string;
}

export interface AppleWalletProvisionResult {
  success: boolean;
  error?: string;
}

export enum AppleWalletCardStatus {
  NOT_ADDED = 'not_added',
  ADDED = 'added',
  UNKNOWN = 'unknown',
}
