export enum BridgeTransferFiatCurrency {
  USD = 'usd',
  EUR = 'eur',
  GBP = 'gbp',
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
  FPS = 'fps',
}

export const FIAT_LABEL: Record<BridgeTransferFiatCurrency, string> = {
  [BridgeTransferFiatCurrency.USD]: 'USD',
  [BridgeTransferFiatCurrency.EUR]: 'EUR',
  [BridgeTransferFiatCurrency.GBP]: 'GBP',
  [BridgeTransferFiatCurrency.MXN]: 'MXN',
  [BridgeTransferFiatCurrency.BRL]: 'BRL',
};

export const CRYPTO_LABEL: Record<BridgeTransferCryptoCurrency, string> = {
  [BridgeTransferCryptoCurrency.USDC]: 'USDC',
  [BridgeTransferCryptoCurrency.USDT]: 'USDT',
};

export const METHOD_LABEL: Record<BridgeTransferMethod, string> = {
  [BridgeTransferMethod.ACH_PUSH]: 'ACH Push',
  [BridgeTransferMethod.WIRE]: 'Wire',
  [BridgeTransferMethod.SEPA]: 'SEPA',
  [BridgeTransferMethod.SPEI]: 'SPEI',
  [BridgeTransferMethod.PIX]: 'Pix (Beta)',
  [BridgeTransferMethod.FPS]: 'Faster Payments',
};

export const METHOD_SUBTITLE: Partial<Record<BridgeTransferMethod, string>> = {
  [BridgeTransferMethod.ACH_PUSH]: 'Instant',
  [BridgeTransferMethod.WIRE]: '~1-2 business days',
};

export enum Endorsements {
  BASE = 'base',
  SEPA = 'sepa',
  SPEI = 'spei',
  CARDS = 'cards',
  PIX = 'pix',
  FASTER_PAYMENTS = 'faster_payments',
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
