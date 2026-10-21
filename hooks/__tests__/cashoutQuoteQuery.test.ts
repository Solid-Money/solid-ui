/// <reference types="jest" />

import { QueryClient } from '@tanstack/react-query';

import { cashoutLimitsKey, cashoutQuoteQuery } from '@/hooks/useTransfiCashout';
import { getTransfiCashoutQuote } from '@/lib/api';
import { TRANSFI_ERROR_CODE, TransfiError } from '@/lib/transfiErrors';

jest.mock('@/lib/api', () => ({ getTransfiCashoutQuote: jest.fn() }));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

const getQuote = getTransfiCashoutQuote as jest.Mock;

const LIMITS = { minLimit: 26.256445, maxLimit: 100019.160769 };

describe('cashoutQuoteQuery', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    getQuote.mockReset();
  });

  afterEach(() => queryClient.clear());

  const fetchQuote = (amount: string, paymentCode = 'zm_mobile_money') =>
    queryClient.fetchQuery({
      ...cashoutQuoteQuery(queryClient, amount, 'ZMW', paymentCode),
      retry: false,
    });

  it('refreshes the limits for the method from every quote', async () => {
    getQuote.mockResolvedValue({
      usdcAmount: '100',
      fiatCurrency: 'ZMW',
      paymentCode: 'zm_mobile_money',
      ...LIMITS,
    });

    await fetchQuote('100');

    const cached = queryClient.getQueryState(cashoutLimitsKey('ZMW', 'zm_mobile_money'));
    expect(cached?.data).toEqual(LIMITS);
  });

  it('refreshes them from a refusal of an out-of-range amount', async () => {
    getQuote.mockRejectedValue(
      new TransfiError(
        TRANSFI_ERROR_CODE.CASHOUT_AMOUNT_OUT_OF_LIMITS,
        'adjust_amount',
        'The minimum cash-out is 26.26 USDC',
        400,
        LIMITS,
      ),
    );

    await expect(fetchQuote('1')).rejects.toBeInstanceOf(TransfiError);

    expect(queryClient.getQueryData(cashoutLimitsKey('ZMW', 'zm_mobile_money'))).toEqual(LIMITS);
  });

  it('keeps each method’s limits apart', async () => {
    queryClient.setQueryData(cashoutLimitsKey('ZMW', 'zm_bank'), {
      minLimit: 50,
      maxLimit: 5000,
    });
    getQuote.mockResolvedValue({ usdcAmount: '100', fiatCurrency: 'ZMW', ...LIMITS });

    await fetchQuote('100', 'zm_mobile_money');

    expect(queryClient.getQueryData(cashoutLimitsKey('ZMW', 'zm_bank'))).toEqual({
      minLimit: 50,
      maxLimit: 5000,
    });
  });

  it('leaves the cache alone when a quote states no limits', async () => {
    getQuote.mockResolvedValue({ usdcAmount: '100', fiatCurrency: 'ZMW' });

    await fetchQuote('100');

    expect(queryClient.getQueryData(cashoutLimitsKey('ZMW', 'zm_mobile_money'))).toBeUndefined();
  });
});
