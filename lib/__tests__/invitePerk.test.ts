import {
  inviteDiscountLine,
  invitePerkShort,
  kolSepaPerkCopy,
  perkDay,
  readInvitePerk,
  readUserKolPerk,
  sepaPerkSentence,
} from '@/lib/referral/invitePerk';

describe('readInvitePerk', () => {
  it('reads a perk', () => {
    expect(
      readInvitePerk({
        tierDiscountPct: 50,
        sepaFreeMonths: 1,
        sepaFreeCapUsd: 10000,
        endsAt: '2026-12-23T00:00:00.000Z',
      }),
    ).toEqual({
      tierDiscountPct: 50,
      sepaFreeMonths: 1,
      sepaFreeCapUsd: 10000,
      endsAt: '2026-12-23T00:00:00.000Z',
    });
  });

  it('treats a missing, empty or malformed perk as none', () => {
    expect(readInvitePerk(undefined)).toBeNull();
    expect(readInvitePerk(null)).toBeNull();
    expect(readInvitePerk('50%')).toBeNull();
    expect(readInvitePerk({ tierDiscountPct: 0, sepaFreeMonths: 0 })).toBeNull();
    expect(readInvitePerk({ tierDiscountPct: 'lots', sepaFreeMonths: -1 })).toBeNull();
    expect(readInvitePerk({ tierDiscountPct: 20 })).toEqual({
      tierDiscountPct: 20,
      sepaFreeMonths: 0,
      sepaFreeCapUsd: 0,
      endsAt: '',
    });
  });

  it('never offers free SEPA months without a readable cap', () => {
    for (const sepaFreeCapUsd of ['10000', null, -5, 0, undefined]) {
      // Only the SEPA part: no perk at all.
      expect(readInvitePerk({ sepaFreeMonths: 1, sepaFreeCapUsd })).toBeNull();
      // With a discount: the discount alone.
      expect(readInvitePerk({ tierDiscountPct: 50, sepaFreeMonths: 1, sepaFreeCapUsd })).toEqual({
        tierDiscountPct: 50,
        sepaFreeMonths: 0,
        sepaFreeCapUsd: 0,
        endsAt: '',
      });
    }
  });
});

describe('readUserKolPerk', () => {
  const perk = {
    kolUsername: 'artem.betev',
    grantedAt: '2026-11-23T12:00:00.000Z',
    tierDiscount: { pct: 50, available: true },
    sepa: {
      freeUntil: '2026-12-23T12:00:00.000Z',
      capUsd: 10000,
      coveredUsd: 2500,
      remainingUsd: 7500,
      waivedFeeUsd: 12.5,
      active: true,
    },
  };

  it('reads the user’s perk', () => {
    expect(readUserKolPerk({ perk })).toEqual(perk);
  });

  it('reads none from null, junk or a perk with no benefits', () => {
    expect(readUserKolPerk({ perk: null })).toBeNull();
    expect(readUserKolPerk(undefined)).toBeNull();
    expect(readUserKolPerk({ perk: { kolUsername: 'x' } })).toBeNull();
    expect(readUserKolPerk({ perk: { ...perk, kolUsername: 7 } })).toBeNull();
  });

  it('never reads an unclear flag as active', () => {
    const read = readUserKolPerk({ perk: { ...perk, sepa: { ...perk.sepa, active: 'yes' } } });
    expect(read?.sepa?.active).toBe(false);
  });
});

describe('copy', () => {
  it('says the perk on one line', () => {
    expect(
      invitePerkShort({ tierDiscountPct: 50, sepaFreeMonths: 1, sepaFreeCapUsd: 1, endsAt: '' }),
    ).toBe('50% off Prime & Ultra + free SEPA');
    expect(
      invitePerkShort({ tierDiscountPct: 0, sepaFreeMonths: 2, sepaFreeCapUsd: 1, endsAt: '' }),
    ).toBe('free SEPA');
  });

  it('words the free SEPA months', () => {
    expect(sepaPerkSentence({ sepaFreeMonths: 1, sepaFreeCapUsd: 10000 })).toBe(
      'Free SEPA deposits for your first month, up to $10,000',
    );
    expect(sepaPerkSentence({ sepaFreeMonths: 3, sepaFreeCapUsd: 0 })).toBe(
      'Free SEPA deposits for your first 3 months',
    );
  });

  it('builds the euro account notice only while the perk is active', () => {
    const perk = readUserKolPerk({
      perk: {
        kolUsername: 'artem.betev',
        grantedAt: '',
        tierDiscount: null,
        sepa: {
          freeUntil: '2026-12-23T12:00:00.000Z',
          capUsd: 10000,
          coveredUsd: 2500,
          remainingUsd: 7500.75,
          waivedFeeUsd: 0,
          active: true,
        },
      },
    });
    expect(kolSepaPerkCopy(perk)).toEqual({
      title: 'Your SEPA deposits are free until 23 Dec',
      body: "€0 fee on your next $7,500 of deposits, thanks to artem.betev's invite.",
    });
    expect(kolSepaPerkCopy(null)).toBeNull();
    expect(
      kolSepaPerkCopy(perk && { ...perk, sepa: perk.sepa && { ...perk.sepa, active: false } }),
    ).toBeNull();
  });

  it('words the invite discount', () => {
    expect(inviteDiscountLine({ pct: 50, inviterUsername: 'artem.betev' })).toBe(
      "50% off your first year with artem.betev's invite",
    );
    expect(inviteDiscountLine({ pct: 50, inviterUsername: '' })).toBe('50% off your first year');
    expect(inviteDiscountLine(null)).toBe('');
  });

  it('formats a UTC day', () => {
    expect(perkDay('2026-12-23T23:30:00.000Z')).toBe('23 Dec');
    expect(perkDay('not a date')).toBe('');
  });
});
