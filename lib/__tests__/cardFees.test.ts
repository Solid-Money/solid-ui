import {
  CardFeeCategory,
  CardFeeStatus,
  CardFeeWaiveReason,
  CardTransactionFee,
} from '@/lib/types';
import { formatCardFeeRate, getCardFeeInfo } from '@/lib/utils/cardHelpers';

const fee = (overrides: Partial<CardTransactionFee> = {}): CardTransactionFee => ({
  category: CardFeeCategory.FX,
  label: 'FX fee',
  amount: '0.99',
  currency: 'usd',
  percentage: 0.0099,
  status: CardFeeStatus.Charged,
  tier: 'core',
  ...overrides,
});

describe('getCardFeeInfo', () => {
  it('returns nothing when the transaction carries no fees', () => {
    expect(getCardFeeInfo({})).toBeNull();
    expect(getCardFeeInfo({ fees: [] })).toBeNull();
  });

  it('shows a charged fee as a negative amount with its rate', () => {
    expect(getCardFeeInfo({ fees: [fee()] })).toEqual({
      amount: '-$0.99',
      label: 'FX fee',
      isWaived: false,
      isPending: false,
      rate: '0.99%',
    });
  });

  it('marks a fee that has not been charged yet as pending', () => {
    const info = getCardFeeInfo({
      fees: [fee({ status: CardFeeStatus.Pending })],
    });

    expect(info?.isPending).toBe(true);
    expect(info?.amount).toBe('-$0.99');
  });

  it('still shows a failed fee — the retry will move the balance', () => {
    const info = getCardFeeInfo({
      fees: [fee({ status: CardFeeStatus.Failed })],
    });

    expect(info?.isPending).toBe(true);
    expect(info?.amount).toBe('-$0.99');
  });

  it('names the tier that earned a waived fee', () => {
    const info = getCardFeeInfo({
      fees: [
        fee({
          amount: '0.00',
          percentage: 0,
          status: CardFeeStatus.Waived,
          waive_reason: CardFeeWaiveReason.TierFree,
          tier: 'ultra',
        }),
      ],
    });

    expect(info).toEqual({
      amount: 'Free',
      label: 'FX fee',
      isWaived: true,
      isPending: false,
      rate: '',
      waivedNote: 'Waived on Ultra',
    });
  });

  it('says nothing when the fee was waived only because the program is off', () => {
    // Our configuration, not a benefit the user earned — showing "Free" here
    // would advertise a perk that disappears the day fees launch.
    expect(
      getCardFeeInfo({
        fees: [
          fee({
            amount: '0.00',
            status: CardFeeStatus.Waived,
            waive_reason: CardFeeWaiveReason.Disabled,
          }),
        ],
      }),
    ).toBeNull();
  });

  it('says nothing when the fee rounded below the minimum charge', () => {
    expect(
      getCardFeeInfo({
        fees: [
          fee({
            amount: '0.00',
            status: CardFeeStatus.Waived,
            waive_reason: CardFeeWaiveReason.BelowMinimum,
          }),
        ],
      }),
    ).toBeNull();
  });

  it('prefers what the user paid over what they did not', () => {
    const info = getCardFeeInfo({
      fees: [
        fee({
          category: CardFeeCategory.OFF_RAMP,
          label: 'Off-ramp fee',
          amount: '0.00',
          status: CardFeeStatus.Waived,
          waive_reason: CardFeeWaiveReason.TierFree,
        }),
        fee(),
      ],
    });

    expect(info?.label).toBe('FX fee');
    expect(info?.amount).toBe('-$0.99');
  });

  it('shows the largest charged fee when several apply', () => {
    const info = getCardFeeInfo({
      fees: [
        fee({ amount: '0.25', label: 'Off-ramp fee' }),
        fee({ amount: '1.40', label: 'FX fee' }),
      ],
    });

    expect(info?.label).toBe('FX fee');
    expect(info?.amount).toBe('-$1.40');
  });
});

describe('formatCardFeeRate', () => {
  it.each([
    [0.0099, '0.99%'],
    [0.005, '0.5%'],
    [0.0049, '0.49%'],
    [0.01, '1%'],
    [0, ''],
    [Number.NaN, ''],
  ])('%s → "%s"', (input, expected) => {
    expect(formatCardFeeRate(input)).toBe(expected);
  });
});
