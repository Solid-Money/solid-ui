import type { MainCurrency } from '@/lib/types';

/** How each currency is named in the Manage card row and on its card. */
export const MAIN_CURRENCY_LABEL: Record<MainCurrency, string> = {
  USD: 'US dollar',
  EUR: 'Euro',
};

/**
 * What picking a currency means, in the three lines its card shows once selected
 * (Figma 29236:9952, 29236:10233).
 *
 * The FX line follows what is actually free. A euro shop is paid from EURC once EURC is on,
 * whichever currency is picked, so the dollar card can only promise free euro payments after
 * that. The euro card always can: choosing it turns EURC on.
 */
export const mainCurrencyLines = (currency: MainCurrency, isEurcOn: boolean): string[] => {
  const unit = currency === 'EUR' ? 'euros' : 'dollars';
  const freeOnEuros = currency === 'EUR' || isEurcOn;

  return [
    `Your balance shows in ${unit}`,
    `You pay in ${unit} by default`,
    freeOnEuros ? 'No FX fees on euro and dollar payments' : 'No FX fees on dollar payments',
  ];
};
