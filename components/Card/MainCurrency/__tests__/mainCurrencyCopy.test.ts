import {
  MAIN_CURRENCY_LABEL,
  mainCurrencyLines,
} from '@/components/Card/MainCurrency/mainCurrencyCopy';

describe('mainCurrencyLines', () => {
  it('promises only dollar payments free of FX on the dollar card until EURC is on', () => {
    expect(mainCurrencyLines('USD', false)).toEqual([
      'Your balance shows in dollars',
      'You pay in dollars by default',
      'No FX fees on dollar payments',
    ]);
  });

  it('adds euro payments to the dollar card once EURC is on', () => {
    expect(mainCurrencyLines('USD', true)[2]).toBe('No FX fees on euro and dollar payments');
  });

  it('always promises euro and dollar payments free of FX on the euro card', () => {
    for (const isEurcOn of [false, true]) {
      expect(mainCurrencyLines('EUR', isEurcOn)).toEqual([
        'Your balance shows in euros',
        'You pay in euros by default',
        'No FX fees on euro and dollar payments',
      ]);
    }
  });

  it('names each currency as the Manage card row does', () => {
    expect(MAIN_CURRENCY_LABEL).toEqual({ USD: 'US dollar', EUR: 'Euro' });
  });
});
