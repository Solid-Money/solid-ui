import { useEffect, useState } from 'react';

import { SwapFieldType } from '@/lib/types/swap-field';

/** How long typing has to pause before the amount is quoted. */
export const QUOTE_DEBOUNCE_MS = 300;

/**
 * How often a price on screen is fetched again while the user looks at it.
 * The review screen promises this ("we re-check the price every 30 seconds"),
 * and a swap re-quotes once more just before it's signed.
 */
export const SWAP_PRICE_RECHECK_MS = 30_000;

/**
 * The swap form's field and amount as far as quoting goes: what's typed, once
 * typing pauses.
 *
 * Only a new, non-empty amount waits. Clearing the field, or flipping the pair
 * (which carries the same amount over to the other side), applies at once, so
 * the form never quotes an amount that's already gone. While an amount waits,
 * this keeps returning the last one it let through, with `pending` set.
 */
export function useQuoteInput(independentField: SwapFieldType, typedValue: string) {
  const [settled, setSettled] = useState({ independentField, typedValue });
  const pending = typedValue !== '' && typedValue !== settled.typedValue;

  useEffect(() => {
    const timeout = setTimeout(
      () =>
        setSettled(current =>
          current.independentField === independentField && current.typedValue === typedValue
            ? current
            : { independentField, typedValue },
        ),
      pending ? QUOTE_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timeout);
  }, [independentField, typedValue, pending]);

  return pending ? { ...settled, pending } : { independentField, typedValue, pending };
}
