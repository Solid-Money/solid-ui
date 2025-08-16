export enum BridgeTransferFiatCurrency {
  USD = 'usd',
  EUR = 'eur',
  MXN = 'mxn',
}

export enum BridgeTransferCryptoCurrency {
  USDC = 'usdc',
  USDT = 'usdt',
}

export enum BridgeTransferMethod {
  ACH = 'ach',
  ACH_PUSH = 'ach_push',
  WIRE = 'wire',
  SEPA = 'sepa',
  SPEI = 'spei',
  SWIFT = 'swift',
}

export const FIAT_LABEL: Record<BridgeTransferFiatCurrency, string> = {
  [BridgeTransferFiatCurrency.USD]: 'USD',
  [BridgeTransferFiatCurrency.EUR]: 'EUR',
  [BridgeTransferFiatCurrency.MXN]: 'MXN',
};

export const CRYPTO_LABEL: Record<BridgeTransferCryptoCurrency, string> = {
  [BridgeTransferCryptoCurrency.USDC]: 'USDC',
  [BridgeTransferCryptoCurrency.USDT]: 'USDT',
};

export const METHOD_LABEL: Record<BridgeTransferMethod, string> = {
  [BridgeTransferMethod.ACH]: 'ACH',
  [BridgeTransferMethod.ACH_PUSH]: 'ACH Push',
  [BridgeTransferMethod.WIRE]: 'Wire',
  [BridgeTransferMethod.SEPA]: 'SEPA',
  [BridgeTransferMethod.SPEI]: 'SPEI',
  [BridgeTransferMethod.SWIFT]: 'SWIFT',
};

export enum Endorsements {
  BASE = 'base',
  SEPA = 'sepa',
  SPEI = 'spei',
  CARDS = 'cards',
}

export enum EndorsementStatus {
  INCOMPLETE = 'incomplete',
  APPROVED = 'approved',
  REVOKED = 'revoked',
}
