import { isAddress } from 'viem';

export type AddressFormat = 'evm' | 'tron' | 'solana' | 'unknown';

/** Tron base58check addresses: "T" followed by 33 base58 characters. */
const TRON_ADDRESS = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
/** Solana public keys: base58, 32–44 characters. */
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Tell which chain family an address string belongs to, so the send flow can
 * explain why a Tron or Solana deposit address can't be used instead of a bare
 * "invalid address". Only EVM addresses are sendable.
 */
export const detectAddressFormat = (input: string): AddressFormat => {
  const value = input.trim();
  if (!value) return 'unknown';
  if (value.startsWith('0x')) return isAddress(value) ? 'evm' : 'unknown';
  if (TRON_ADDRESS.test(value)) return 'tron';
  if (SOLANA_ADDRESS.test(value)) return 'solana';
  return 'unknown';
};

export const UNSUPPORTED_ADDRESS_MESSAGE: Partial<Record<AddressFormat, string>> = {
  tron: "Tron addresses aren't supported yet. Use an EVM network address.",
  solana: "Solana addresses aren't supported yet. Use an EVM network address.",
};
