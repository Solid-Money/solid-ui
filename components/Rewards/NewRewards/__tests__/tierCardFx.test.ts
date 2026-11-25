import {
  CARD_FX_LINE_KEY,
  cardFxPerk,
  showsCardFxPricing,
  type TierFeeRow,
  withCardFxRow,
} from '@/components/Rewards/NewRewards/tierCardFx';
import { CardProvider, type TierCardFx } from '@/lib/types';

/** The live prices: Core pays the full 1.5%, Prime half of it, Ultra none. */
const CORE: TierCardFx = { rate: 0.015, value: '1.5%', baseRate: 0.015 };
const PRIME: TierCardFx = { rate: 0.0075, value: '0.75%', baseRate: 0.015 };
const ULTRA: TierCardFx = { rate: 0, value: 'Free', baseRate: 0.015 };

const LINES: TierFeeRow[] = [
  { key: 'virtual_card', label: 'Virtual Card', value: 'Free' },
  { key: 'bank_deposit', label: 'Bank deposit', value: '0.5%' },
  { key: 'swap', label: 'Swaps', value: '0.5%' },
  { key: 'offramp', label: 'Bank withdrawal', value: '0.5%' },
];

describe('cardFxPerk', () => {
  it('gives Ultra the full fee', () => {
    expect(cardFxPerk(ULTRA)).toEqual({
      icon: 'fx',
      title: '0% FX fee',
      description: 'We cover the full FX fee on card spend',
      badge: 'New',
    });
  });

  it('gives Prime half of it', () => {
    expect(cardFxPerk(PRIME)).toEqual({
      icon: 'fx',
      title: 'Half the FX fee',
      description: 'We cover half the FX fee on card spend',
      badge: 'New',
    });
  });

  it('gives Core no perk: it pays the fee in full', () => {
    expect(cardFxPerk(CORE)).toBeNull();
  });

  it('states any other share as a share, so a repriced tier never says "half"', () => {
    expect(cardFxPerk({ rate: 0.005, value: '0.5%', baseRate: 0.015 })).toEqual({
      icon: 'fx',
      title: '0.5% FX fee',
      description: 'We cover 67% of the FX fee on card spend',
      badge: 'New',
    });
  });

  it('says nothing without a price, or when there is no fee to cover', () => {
    expect(cardFxPerk(undefined)).toBeNull();
    expect(cardFxPerk(null)).toBeNull();
    // Every tier free: nothing is being covered relative to Core.
    expect(cardFxPerk({ rate: 0, value: 'Free', baseRate: 0 })).toBeNull();
    // A tier that pays more than Core is not a perk.
    expect(cardFxPerk({ rate: 0.02, value: '2%', baseRate: 0.015 })).toBeNull();
    expect(cardFxPerk({ rate: NaN, value: 'Free', baseRate: 0.015 })).toBeNull();
  });
});

describe('withCardFxRow', () => {
  it('puts the row just above Bank withdrawal', () => {
    expect(withCardFxRow(LINES, PRIME).map(line => line.key)).toEqual([
      'virtual_card',
      'bank_deposit',
      'swap',
      CARD_FX_LINE_KEY,
      'offramp',
    ]);
  });

  it('labels it and quotes the backend value', () => {
    const row = withCardFxRow(LINES, CORE).find(line => line.key === CARD_FX_LINE_KEY);

    expect(row).toEqual({ key: 'card_fx', label: 'Card FX fee', value: '1.5%', highlight: false });
  });

  it('draws Prime and Ultra green, since they pay less than Core', () => {
    const highlight = (cardFx: TierCardFx) =>
      withCardFxRow(LINES, cardFx).find(line => line.key === CARD_FX_LINE_KEY)?.highlight;

    expect(highlight(CORE)).toBe(false);
    expect(highlight(PRIME)).toBe(true);
    expect(highlight(ULTRA)).toBe(true);
  });

  it('appends the row when there is no withdrawal row', () => {
    const rows = withCardFxRow(
      LINES.filter(line => line.key !== 'offramp'),
      ULTRA,
    );

    expect(rows[rows.length - 1].key).toBe(CARD_FX_LINE_KEY);
  });

  it('leaves the table alone without a price', () => {
    expect(withCardFxRow(LINES, undefined)).toBe(LINES);
    expect(withCardFxRow(LINES, null)).toBe(LINES);
  });
});

describe('showsCardFxPricing', () => {
  it('shows Wirex cardholders the price', () => {
    expect(showsCardFxPricing({ provider: CardProvider.WIREX, cardStatusSettled: true })).toBe(
      true,
    );
  });

  it('shows someone with no card yet, who will get a Wirex card', () => {
    expect(showsCardFxPricing({ provider: null, cardStatusSettled: true })).toBe(true);
  });

  it('hides it from Rain cardholders, who keep Rain’s fee', () => {
    expect(showsCardFxPricing({ provider: CardProvider.RAIN, cardStatusSettled: true })).toBe(
      false,
    );
  });

  it('waits for the card status, so a Rain cardholder is never flashed it', () => {
    expect(showsCardFxPricing({ provider: null, cardStatusSettled: false })).toBe(false);
  });
});
