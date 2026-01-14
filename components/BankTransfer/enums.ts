export enum BridgeTransferFiatCurrency {
  USD = 'usd',
  EUR = 'eur',
  MXN = 'mxn',
  BRL = 'brl',
}

export enum BridgeTransferCryptoCurrency {
  USDC = 'usdc',
  USDT = 'usdt',
}

export enum BridgeTransferMethod {
  ACH_PUSH = 'ach_push',
  WIRE = 'wire',
  SEPA = 'sepa',
  SPEI = 'spei',
  PIX = 'pix',
}

export const FIAT_LABEL: Record<BridgeTransferFiatCurrency, string> = {
  [BridgeTransferFiatCurrency.USD]: 'USD',
  [BridgeTransferFiatCurrency.EUR]: 'EUR',
  [BridgeTransferFiatCurrency.MXN]: 'MXN',
  [BridgeTransferFiatCurrency.BRL]: 'BRL',
};

export const CRYPTO_LABEL: Record<BridgeTransferCryptoCurrency, string> = {
  [BridgeTransferCryptoCurrency.USDC]: 'USDC',
  [BridgeTransferCryptoCurrency.USDT]: 'USDT',
};

export const METHOD_LABEL: Record<BridgeTransferMethod, string> = {
  [BridgeTransferMethod.ACH_PUSH]: 'ACH Push (Instant)',
  [BridgeTransferMethod.WIRE]: 'Wire (1-2 business days)',
  [BridgeTransferMethod.SEPA]: 'SEPA',
  [BridgeTransferMethod.SPEI]: 'SPEI',
  [BridgeTransferMethod.PIX]: 'Pix (Beta)',
};

export enum Endorsements {
  BASE = 'base',
  SEPA = 'sepa',
  SPEI = 'spei',
  CARDS = 'cards',
  PIX = 'pix',
}

export enum EndorsementStatus {
  INCOMPLETE = 'incomplete',
  APPROVED = 'approved',
  REVOKED = 'revoked',
}

// Minimum transfer amounts by fiat currency
export const MINIMUM_TRANSFER_AMOUNT: Partial<Record<BridgeTransferFiatCurrency, number>> = {
  [BridgeTransferFiatCurrency.MXN]: 50,
};

export function getMinimumAmount(fiat: BridgeTransferFiatCurrency): number | undefined {
  return MINIMUM_TRANSFER_AMOUNT[fiat];
}
