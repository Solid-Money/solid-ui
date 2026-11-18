import {
  aiApiLimitProgress,
  aiApiModelDiscount,
  aiApiModelIsFree,
  aiApiModelTag,
  aiApiSharedTierRate,
  formatAiApiBillingFunds,
  formatAiApiCashback,
  formatAiApiCashbackNote,
  formatAiApiCount,
  formatAiApiDay,
  formatAiApiDiscount,
  formatAiApiLastUsed,
  formatAiApiLimit,
  formatAiApiLongDate,
  formatAiApiModelSpeed,
  formatAiApiNotCounted,
  formatAiApiPaidFrom,
  formatAiApiRate,
  formatAiApiShortDate,
  formatAiApiTierCaps,
  formatAiApiTokenPrice,
  formatAiApiTokens,
  formatAiApiUsd,
  maskAiApiKey,
} from '@/components/AiApi/aiApiFormat';

describe('formatAiApiUsd', () => {
  it.each([
    [42.8, '$42.80'],
    [0.5, '$0.50'],
    [0, '$0.00'],
    [1234.567, '$1,234.57'],
    [-3, '$0.00'],
    [Number.NaN, '$0.00'],
  ])('formats %p as %s', (value, expected) => {
    expect(formatAiApiUsd(value)).toBe(expected);
  });

  it('marks cashback as money coming back', () => {
    expect(formatAiApiCashback(21.4)).toBe('+$21.40');
  });
});

describe('formatAiApiLimit', () => {
  it('shows limits in whole dollars', () => {
    expect(formatAiApiLimit(50)).toBe('$50');
    expect(formatAiApiLimit(1000)).toBe('$1,000');
  });
});

describe('formatAiApiRate', () => {
  it.each([
    [0.5, '50%'],
    [0.125, '12.5%'],
    [0, '0%'],
  ])('formats a rate of %p as %s', (rate, expected) => {
    expect(formatAiApiRate(rate)).toBe(expected);
  });
});

describe('formatAiApiTokens', () => {
  it.each([
    [1_200_000, '1.2M tokens'],
    [840_000, '840K tokens'],
    [312, '312 tokens'],
  ])('formats %p as %s', (tokens, expected) => {
    expect(formatAiApiTokens(tokens)).toBe(expected);
  });
});

describe('formatAiApiModelSpeed', () => {
  it('shows speed in whole tokens a second and the first token to one decimal', () => {
    expect(formatAiApiModelSpeed({ tokensPerSecond: 84.6, timeToFirstTokenMs: 1234 })).toBe(
      '~85 tokens/s · first token in 1.2 s',
    );
    expect(formatAiApiModelSpeed({ tokensPerSecond: 1250, timeToFirstTokenMs: 12_340 })).toBe(
      '~1,250 tokens/s · first token in 12.3 s',
    );
  });

  it('shows whichever half was measured', () => {
    expect(formatAiApiModelSpeed({ tokensPerSecond: 85, timeToFirstTokenMs: null })).toBe(
      '~85 tokens/s',
    );
    expect(formatAiApiModelSpeed({ tokensPerSecond: null, timeToFirstTokenMs: 800 })).toBe(
      'First token in 0.8 s',
    );
  });

  it('never reads a fast first token as 0.0 s', () => {
    expect(formatAiApiModelSpeed({ timeToFirstTokenMs: 30 })).toBe('First token in 0.1 s');
  });

  it.each([
    ['nothing measured', { tokensPerSecond: null, timeToFirstTokenMs: null }],
    ['an older backend', {}],
    ['nonsense', { tokensPerSecond: Number.NaN, timeToFirstTokenMs: -5 }],
  ])('shows nothing for %s', (_label, model) => {
    expect(formatAiApiModelSpeed(model)).toBeNull();
  });
});

describe('dates', () => {
  it('reads dates as UTC days, the way the backend keys them', () => {
    expect(formatAiApiShortDate('2026-11-01T00:00:00.000Z')).toBe('Nov 1');
    expect(formatAiApiLongDate('2026-10-14T23:30:00.000Z')).toBe('Oct 14, 2026');
    expect(formatAiApiDay('2026-10-14')).toBe('Oct 14');
  });

  it('says how long ago a key was last used', () => {
    const now = new Date('2026-10-25T12:00:00.000Z');
    expect(formatAiApiLastUsed(null, now)).toBe('never');
    expect(formatAiApiLastUsed('2026-10-25T11:59:30.000Z', now)).toBe('just now');
    expect(formatAiApiLastUsed('2026-10-25T11:58:00.000Z', now)).toBe('2 min ago');
    expect(formatAiApiLastUsed('2026-10-25T09:00:00.000Z', now)).toBe('3 h ago');
    expect(formatAiApiLastUsed('2026-10-24T08:00:00.000Z', now)).toBe('yesterday');
    expect(formatAiApiLastUsed('2026-10-03T08:00:00.000Z', now)).toBe('Oct 3');
  });
});

describe('keys and limits', () => {
  it('never shows more of a key than its last four', () => {
    expect(maskAiApiKey('4f2a')).toBe('…4f2a');
  });

  it('clamps limit progress to the bar', () => {
    expect(aiApiLimitProgress(25, 50)).toBe(0.5);
    expect(aiApiLimitProgress(80, 50)).toBe(1);
    expect(aiApiLimitProgress(5, 0)).toBe(0);
  });
});

describe('formatAiApiPaidFrom', () => {
  it('names the billing tokens in the order a charge draws them', () => {
    expect(formatAiApiPaidFrom(['USDC'])).toBe('USDC');
    expect(formatAiApiPaidFrom(['USDC', 'soUSD'])).toBe('USDC, then soUSD');
    expect(formatAiApiPaidFrom(['USDC', 'USDT', 'soUSD'])).toBe('USDC, USDT, then soUSD');
  });

  it('falls back to the Wallet when the list could not be read', () => {
    expect(formatAiApiPaidFrom([])).toBe('Your Wallet');
  });
});

describe('the "not enough" banners', () => {
  it('names what the Wallet is short of, and plain funds when the list could not be read', () => {
    expect(formatAiApiBillingFunds(['USDC'])).toBe('USDC');
    expect(formatAiApiBillingFunds(['USDC', 'soUSD'])).toBe('USDC, then soUSD');
    expect(formatAiApiBillingFunds([])).toBe('funds');
  });

  it('says the card balance and Savings don’t pay for usage', () => {
    expect(formatAiApiNotCounted(['USDC'])).toBe('Your card balance and Savings don’t count.');
  });

  it('leaves Savings out once a savings token pays, or when the list is unknown', () => {
    expect(formatAiApiNotCounted(['USDC', 'soUSD'])).toBe('Your card balance doesn’t count.');
    expect(formatAiApiNotCounted([])).toBe('Your card balance doesn’t count.');
  });
});

describe('model prices', () => {
  it.each([
    // Figma's price sheet, priced from the dashboard's live launch list.
    [1.14, '$1.14'],
    [0.38, '$0.38'],
    [0.266, '$0.27'],
    [0.2166, '$0.22'],
    [0.0722, '$0.072'],
    [0.003612, '$0.004'],
    [0.00784, '$0.008'],
    [0.007288, '$0.007'],
    [15, '$15.00'],
    [0.0996, '$0.10'],
    [0.0003, '<$0.001'],
    [0, 'Free'],
  ])('writes %p per 1M tokens as %p', (price, shown) => {
    expect(formatAiApiTokenPrice(price)).toBe(shown);
  });

  const opus = {
    inputUsdPerMTok: 0.4,
    outputUsdPerMTok: 2.4,
    officialInputUsdPerMTok: 15,
    officialOutputUsdPerMTok: 75,
  };

  it('measures the saving on three input tokens to one output token, rounded down', () => {
    // Ours blends to $0.90, the official price to $30: 97% less.
    expect(aiApiModelDiscount(opus)).toBe(97);
    expect(formatAiApiDiscount(97)).toBe('\u221297%');
    // Input weighs three times as much as output: the same $3.60 more costs
    // 9 points on input but 3 on output.
    expect(aiApiModelDiscount({ ...opus, inputUsdPerMTok: 4 })).toBe(88);
    expect(aiApiModelDiscount({ ...opus, outputUsdPerMTok: 6 })).toBe(94);
  });

  it('never reads a float just under a whole percent as one less', () => {
    expect(aiApiModelDiscount({ ...opus, inputUsdPerMTok: 0.9, outputUsdPerMTok: 4.5 })).toBe(94);
  });

  it('shows no saving without a list price, or when ours is not below it', () => {
    expect(aiApiModelDiscount({ ...opus, officialInputUsdPerMTok: null })).toBeNull();
    expect(aiApiModelDiscount({ ...opus, officialOutputUsdPerMTok: 0 })).toBeNull();
    expect(aiApiModelDiscount({ ...opus, inputUsdPerMTok: 20, outputUsdPerMTok: 80 })).toBeNull();
  });

  it('tags a model we charge nothing for as free, list price or not', () => {
    const free = { ...opus, inputUsdPerMTok: 0, outputUsdPerMTok: 0, cachedInputUsdPerMTok: 0 };
    expect(aiApiModelIsFree(free)).toBe(true);
    expect(aiApiModelTag(free)).toBe('Free');
    expect(aiApiModelTag({ ...free, officialInputUsdPerMTok: null })).toBe('Free');
    expect(aiApiModelIsFree({ ...free, cachedInputUsdPerMTok: 0.01 })).toBe(false);
  });

  it('tags a priced model with its saving, and nothing without a list price', () => {
    expect(aiApiModelTag(opus)).toBe('\u221297%');
    expect(aiApiModelTag({ ...opus, officialOutputUsdPerMTok: null })).toBeNull();
  });
});

describe('cashback copy', () => {
  const tiers = [
    { tier: 'Core', rate: 0.5, monthlyCapUsd: 50 },
    { tier: 'Prime', rate: 0.5, monthlyCapUsd: 100 },
    { tier: 'Ultra', rate: 0.5, monthlyCapUsd: 200 },
  ];

  it('names every tier\u2019s cap, the way the footnote reads', () => {
    expect(formatAiApiTierCaps(tiers)).toBe(
      'up to $50 a month on Core, $100 on Prime and $200 on Ultra',
    );
    expect(formatAiApiTierCaps(tiers.slice(2))).toBe('up to $200 a month on Ultra');
  });

  it('leaves out a tier without a cap, and says nothing when none has one', () => {
    expect(formatAiApiTierCaps([tiers[0], { ...tiers[2], monthlyCapUsd: 0 }])).toBe(
      'up to $50 a month on Core',
    );
    expect(formatAiApiTierCaps([])).toBeNull();
  });

  it('finds the rate every tier shares, and none when they differ', () => {
    expect(aiApiSharedTierRate(tiers)).toBe(0.5);
    expect(aiApiSharedTierRate([tiers[0], { ...tiers[1], rate: 0.6 }])).toBeNull();
    expect(aiApiSharedTierRate([])).toBeNull();
  });

  it('names every tier’s cap in the sheet note when every tier shares the rate', () => {
    expect(
      formatAiApiCashbackNote({
        cashbackRate: 0.5,
        cashbackTiers: tiers,
        cashbackMonthlyCapUsd: 50,
      }),
    ).toBe(
      'You get 50% back on every model, up to $50 a month on Core, $100 on Prime and $200 on Ultra.',
    );
  });

  it('falls back to the user’s own cap when tier rates differ, or none are sent', () => {
    const differing = [{ ...tiers[0], rate: 0.3 }, ...tiers.slice(1)];
    const own = 'You get 50% back on every model, up to $200 a month.';
    expect(
      formatAiApiCashbackNote({
        cashbackRate: 0.5,
        cashbackTiers: differing,
        cashbackMonthlyCapUsd: 200,
      }),
    ).toBe(own);
    expect(
      formatAiApiCashbackNote({ cashbackRate: 0.5, cashbackTiers: [], cashbackMonthlyCapUsd: 200 }),
    ).toBe(own);
    expect(formatAiApiCashbackNote({ cashbackRate: 0.5, cashbackMonthlyCapUsd: 200 })).toBe(own);
    expect(formatAiApiCashbackNote({ cashbackRate: 0.5, cashbackMonthlyCapUsd: 0 })).toBe(
      'You get 50% back on every model.',
    );
  });

  it('spells out small counts to open a sentence', () => {
    expect(formatAiApiCount(6)).toBe('Six');
    expect(formatAiApiCount(1)).toBe('One');
    expect(formatAiApiCount(12)).toBe('12');
  });
});
