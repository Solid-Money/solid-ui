/// <reference types="jest" />

import {
  arrangeCashoutCurrencies,
  cashoutMethodTags,
  isMobileMoneyMethod,
  matchesCashoutQuery,
  onlyCashoutMethod,
  skipsCashoutMethodStep,
} from '@/lib/cashoutMethods';

import type { TransfiCashoutCurrency, TransfiCashoutMethodSummary } from '@/lib/types';

const bank = (name: string, paymentCode = name): TransfiCashoutMethodSummary => ({
  paymentCode,
  name,
  type: 'bank',
});
const wallet = (name: string, paymentCode = name): TransfiCashoutMethodSummary => ({
  paymentCode,
  name,
  type: 'mobile_money',
});

const NIGERIA: TransfiCashoutCurrency = {
  currency: 'NGN',
  country: 'Nigeria',
  methods: [wallet('PalmPay'), bank('Access Bank'), bank('GTBank'), bank('Zenith Bank')],
};
const BRAZIL: TransfiCashoutCurrency = {
  currency: 'BRL',
  country: 'Brazil',
  methods: [bank('PIX')],
};
const EUROZONE: TransfiCashoutCurrency = {
  currency: 'EUR',
  country: 'Eurozone',
  methods: [bank('SEPA Instant')],
};
const KENYA: TransfiCashoutCurrency = {
  currency: 'KES',
  country: 'Kenya',
  methods: [bank('KES Bank Transfer'), wallet('M-Pesa'), wallet('Airtel Money')],
};
const TURKIYE: TransfiCashoutCurrency = {
  currency: 'TRY',
  country: 'Türkiye',
  methods: [bank('TRY Bank Transfer')],
};
/** TransFi wouldn't list its methods: shown, but untagged and unfiltered. */
const UNKNOWN: TransfiCashoutCurrency = { currency: 'XYZ' };
/** TransFi lists the currency but pays out through nothing. */
const EMPTY: TransfiCashoutCurrency = { currency: 'ABC', country: 'Nowhere', methods: [] };

const ALL = [NIGERIA, BRAZIL, EUROZONE, KENYA, TURKIYE, UNKNOWN, EMPTY];

describe('cashoutMethodTags', () => {
  it('names each wallet and folds many banks into one tag', () => {
    expect(cashoutMethodTags(NIGERIA.methods)).toEqual(['PalmPay', 'Bank transfer']);
  });

  it('keeps the name of a single rail', () => {
    expect(cashoutMethodTags(BRAZIL.methods)).toEqual(['PIX']);
    expect(cashoutMethodTags(EUROZONE.methods)).toEqual(['SEPA Instant']);
  });

  it('calls a single generic bank method a bank transfer', () => {
    expect(cashoutMethodTags(TURKIYE.methods)).toEqual(['Bank transfer']);
  });

  it('puts the filtered type first', () => {
    expect(cashoutMethodTags(KENYA.methods)).toEqual(['M-Pesa', 'Airtel Money', 'Bank transfer']);
    expect(cashoutMethodTags(KENYA.methods, 'bank')).toEqual([
      'Bank transfer',
      'M-Pesa',
      'Airtel Money',
    ]);
  });

  it('has nothing to say about unknown methods', () => {
    expect(cashoutMethodTags(undefined)).toEqual([]);
  });
});

describe('matchesCashoutQuery', () => {
  it.each([
    ['nigeria', true],
    ['ngn', true],
    ['palmpay', true],
    ['gtbank', true],
    ['mobile money', true],
    ['nigeria bank', true],
    ['nigeria pix', false],
    ['  ', true],
  ])('Nigeria matches "%s": %s', (query, expected) => {
    expect(matchesCashoutQuery(NIGERIA, query)).toBe(expected);
  });

  it('ignores accents', () => {
    expect(matchesCashoutQuery(TURKIYE, 'turkiye')).toBe(true);
  });
});

describe('arrangeCashoutCurrencies', () => {
  const titles = (list: TransfiCashoutCurrency[]) => list.map(c => c.country ?? c.currency);

  it('sets the user’s currency apart and sorts the rest by name, dropping dead ends', () => {
    const { yours, others } = arrangeCashoutCurrencies({
      currencies: ALL,
      defaultCurrency: 'NGN',
      filter: 'all',
      query: '',
    });
    expect(yours).toBe(NIGERIA);
    expect(titles(others)).toEqual(['Brazil', 'Eurozone', 'Kenya', 'Türkiye', 'XYZ']);
  });

  it('filters by how a country pays out', () => {
    const mobile = arrangeCashoutCurrencies({
      currencies: ALL,
      defaultCurrency: 'NGN',
      filter: 'mobile_money',
      query: '',
    });
    expect(mobile.yours).toBe(NIGERIA);
    expect(titles(mobile.others)).toEqual(['Kenya']);

    const bank = arrangeCashoutCurrencies({
      currencies: ALL,
      defaultCurrency: 'BRL',
      filter: 'bank',
      query: '',
    });
    expect(bank.yours).toBe(BRAZIL);
    expect(titles(bank.others)).toEqual(['Eurozone', 'Kenya', 'Nigeria', 'Türkiye']);
  });

  it('leaves the user’s currency out when it doesn’t match', () => {
    const { yours, others } = arrangeCashoutCurrencies({
      currencies: ALL,
      defaultCurrency: 'NGN',
      filter: 'all',
      query: 'pix',
    });
    expect(yours).toBeUndefined();
    expect(others).toEqual([BRAZIL]);
  });
});

describe('the method step', () => {
  const config = { currencies: ALL, tokenSymbol: 'USDC', tokenNetwork: 'Base', chainId: 8453 };

  it('is skipped only for a currency with one method', () => {
    expect(onlyCashoutMethod(BRAZIL)?.paymentCode).toBe('PIX');
    expect(skipsCashoutMethodStep(config, 'BRL')).toBe(true);
    expect(skipsCashoutMethodStep(config, 'NGN')).toBe(false);
    expect(skipsCashoutMethodStep(config, 'XYZ')).toBe(false);
    expect(skipsCashoutMethodStep(undefined, 'BRL')).toBe(false);
  });
});

describe('isMobileMoneyMethod', () => {
  it('reads the server’s type, or TransFi’s paymentType from an older server', () => {
    expect(isMobileMoneyMethod({ type: 'mobile_money' })).toBe(true);
    expect(isMobileMoneyMethod({ type: 'bank', paymentType: 'local_wallet' })).toBe(false);
    expect(isMobileMoneyMethod({ paymentType: 'local_wallet' })).toBe(true);
    expect(isMobileMoneyMethod({ paymentType: 'bank_transfer' })).toBe(false);
  });
});
