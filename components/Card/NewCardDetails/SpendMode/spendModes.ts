/**
 * The three ways the card can be told to draw on the user's funds (Figma
 * 25847:3581, 25961:3413, 25961:3538).
 *
 * Copy only. Every figure these surfaces show comes from `useSpendModeFigures`,
 * which reads them from whichever spend module operates the Safe — the words
 * live here and the numbers never do, so there is no second place for a stale
 * figure to hide.
 *
 * `cash` is what the card does on the v1 module, which is where every cardholder
 * starts and the only thing v1 can do. The other two need v2, and a Safe is moved
 * there the first time its owner picks one.
 */
export type SpendMode = 'cash' | 'credit' | 'smart';

/** Left-to-right order of the sheet's segmented control. */
export const SPEND_MODES = ['cash', 'credit', 'smart'] as const satisfies readonly SpendMode[];

/** The cards the sheet stacks under the caption. */
export type SpendModePanel = 'balance' | 'borrowed';

interface SpendModeCopy {
  /** Segment name, and the word the "Change to …" button ends on. */
  label: string;
  /** One line under the control saying what this mode actually spends. */
  caption: string;
  panels: readonly SpendModePanel[];
}

export const SPEND_MODE_COPY: Record<SpendMode, SpendModeCopy> = {
  cash: {
    label: 'Cash',
    caption: 'Spend your USDC asset balance',
    panels: ['balance'],
  },
  credit: {
    label: 'Credit',
    caption: 'Spend without selling your assets',
    panels: ['borrowed'],
  },
  smart: {
    label: 'Smart',
    caption: 'Use credit to cover cash purchases',
    // Smart spends cash first and covers the rest with credit, so it is the one
    // mode that answers both questions and shows both cards.
    panels: ['balance', 'borrowed'],
  },
};

/** Which modes the v1 module can serve. Everything else needs a Safe on v2. */
export const V1_MODES: readonly SpendMode[] = ['cash'];
