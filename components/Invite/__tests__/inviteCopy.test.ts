import { inviteCopy, inviteHeaderLabel, inviterInitial } from '@/components/Invite/inviteCopy';

import type { ReferralInviteLookup } from '@/lib/types';

const v4: ReferralInviteLookup = {
  valid: true,
  code: 'ELI10',
  referrer: { username: 'eli' },
  program: 'v4',
  offer: { friendCreditUsd: 10, spendTargetUsd: 150, merchantTarget: 3, windowDays: 30 },
  legacyOffer: null,
};

const headline = (parts: { text: string }[]) => parts.map(part => part.text).join('');

describe('inviteCopy', () => {
  it('words the v4 offer as the design does, with the amount as the accent', () => {
    const copy = inviteCopy(v4);

    expect(copy.inviter).toBe('eli');
    expect(headline(copy.title)).toBe('Get $10 to spend\nwith your card');
    expect(copy.title.filter(part => part.accent).map(part => part.text)).toEqual(['$10']);
    expect(copy.subtitle).toBe(
      'Spend $150 in your first 30 days and your next $10 of purchases are on us.',
    );
    expect(copy.steps).toEqual([
      'Create your account',
      'Get your free card',
      'Spend $150 at 3 or more shops',
    ]);
    expect(copy.footnote).toBe('Card bonus can only be spent with your Solid card.');
  });

  it('accents the reward on the cashback offer and drops the card bonus footnote', () => {
    const copy = inviteCopy({
      ...v4,
      program: 'legacy',
      offer: null,
      legacyOffer: {
        friendRewardUsd: 20,
        spendTargetUsd: 100,
        merchantTarget: 2,
        windowDays: 14,
        payoutToken: 'soUSD',
      },
    } as ReferralInviteLookup);

    expect(headline(copy.title)).toBe('Get $20 when you\nspend with your card');
    expect(copy.title.filter(part => part.accent).map(part => part.text)).toEqual(['$20']);
    expect(copy.subtitle).toBe('Spend $100 in your first 14 days and get $20 in soUSD.');
    expect(copy.footnote).toBeNull();
  });

  it('welcomes without an inviter or an accent when the code is unknown', () => {
    const copy = inviteCopy({ valid: false, code: 'NOPE' });

    expect(copy.inviter).toBeNull();
    expect(copy.title).toEqual([{ text: 'Welcome to Solid' }]);
    expect(copy.footnote).toBeNull();
  });

  it('keeps the inviter when the code is valid but no offer is running', () => {
    const copy = inviteCopy({ ...v4, offer: null, legacyOffer: null });

    expect(copy.inviter).toBe('eli');
    expect(headline(copy.title)).toBe('Welcome to Solid');
  });
});

describe('inviteCopy with a KOL perk', () => {
  const perk = {
    tierDiscountPct: 50,
    sepaFreeMonths: 1,
    sepaFreeCapUsd: 10000,
    endsAt: '2026-12-23T00:00:00.000Z',
  };

  it('leads with the discount, then the free SEPA and the card bonus', () => {
    const copy = inviteCopy({ ...v4, code: 'ARTEM50', perk });

    expect(copy.inviter).toBe('eli');
    expect(headline(copy.title)).toBe('Get 50% off your first\nyear of Prime or Ultra');
    expect(copy.title.filter(part => part.accent).map(part => part.text)).toEqual(['50% off']);
    expect(copy.subtitle).toBe(
      'Plus free SEPA deposits for your first month, up to $10,000. And spend $150 in your first 30 days for a $10 card bonus.',
    );
    expect(copy.steps).toEqual([
      'Create your account',
      'Deposit euros by SEPA with no fee',
      'Upgrade to Prime or Ultra for 50% off',
    ]);
    expect(copy.footnote).toBe('For new accounts created by 23 Dec.');
  });

  it('leads with free SEPA when there is no discount', () => {
    const copy = inviteCopy({ ...v4, perk: { ...perk, tierDiscountPct: 0, sepaFreeMonths: 3 } });
    expect(headline(copy.title)).toBe('Free SEPA deposits\nfor your first 3 months');
    expect(
      copy.subtitle.startsWith('Free SEPA deposits for your first 3 months, up to $10,000.'),
    ).toBe(true);
    expect(copy.steps).toEqual([
      'Create your account',
      'Deposit euros by SEPA with no fee',
      'Get your free card',
    ]);
  });

  it('falls back to the normal invite on a malformed perk', () => {
    expect(headline(inviteCopy({ ...v4, perk: { tierDiscountPct: 'x' } }).title)).toBe(
      'Get $10 to spend\nwith your card',
    );
  });
});

describe('inviterInitial', () => {
  it('upper-cases the first character', () => {
    expect(inviterInitial('eli')).toBe('E');
    expect(inviterInitial('  dana')).toBe('D');
  });

  it('keeps a character outside the basic plane whole', () => {
    expect(inviterInitial('😀sam')).toBe('😀');
  });

  it('is empty for an empty name', () => {
    expect(inviterInitial('')).toBe('');
  });
});

describe('inviteHeaderLabel', () => {
  it('offers a visitor to log in', () => {
    expect(inviteHeaderLabel(false)).toBe('Log in');
  });

  it('offers someone already signed in the way back to the wallet, not a login', () => {
    expect(inviteHeaderLabel(true)).toBe('Go to wallet');
  });
});
