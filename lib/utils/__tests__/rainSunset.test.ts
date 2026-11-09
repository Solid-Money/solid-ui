import {
  blocksNewCard,
  cardNoticeCopy,
  closesPhrase,
  formatClosingBalance,
  formatClosingDate,
  hasClosingBalance,
  homeBannerCopy,
  rainClosingBannerState,
  routesToNewCard,
} from '@/lib/utils/rainSunset';

import type { CardStatusResponse, RainSunsetStatus } from '@/lib/types';

const sunset = (overrides: Partial<RainSunsetStatus> = {}): RainSunsetStatus => ({
  hasRainCard: true,
  notice: true,
  closesAt: '2026-12-07',
  newCardAvailable: false,
  maxLeftoverUsd: 1,
  ...overrides,
});

describe('rainSunset', () => {
  describe('formatClosingDate', () => {
    it('spells the date the way the design does', () => {
      expect(formatClosingDate('2026-12-07')).toEqual({ long: 'December 7', short: 'Dec 7' });
    });

    it('is null when no date is announced or it does not parse', () => {
      expect(formatClosingDate(null)).toBeNull();
      expect(formatClosingDate('')).toBeNull();
      expect(formatClosingDate('2026-13-01')).toBeNull();
      expect(formatClosingDate('Dec 7')).toBeNull();
    });

    it('says "soon" with no date', () => {
      expect(closesPhrase(null)).toBe('soon');
      expect(closesPhrase('2026-12-07')).toBe('on Dec 7');
      expect(closesPhrase('2026-12-07', 'long')).toBe('on December 7');
    });
  });

  describe('balance', () => {
    it('formats with two decimals and thousands', () => {
      expect(formatClosingBalance(248.5)).toBe('$248.50');
      expect(formatClosingBalance(2868.4)).toBe('$2,868.40');
      expect(formatClosingBalance(-3)).toBe('$0.00');
    });

    it('counts a cent and up as a balance to move', () => {
      expect(hasClosingBalance(0)).toBe(false);
      expect(hasClosingBalance(0.004)).toBe(false);
      expect(hasClosingBalance(0.01)).toBe(true);
      expect(hasClosingBalance(null)).toBe(false);
    });

    it('blocks the new card only above the leftover threshold', () => {
      expect(blocksNewCard(0.8, sunset())).toBe(false);
      expect(blocksNewCard(1.5, sunset())).toBe(true);
      expect(blocksNewCard(null, sunset())).toBe(false);
    });
  });

  describe('rainClosingBannerState', () => {
    it('offers the new card first where it is available', () => {
      expect(rainClosingBannerState(sunset({ newCardAvailable: true }), 248.5)).toBe('new-card');
    });

    it('asks for a withdrawal while there is money on a card with no replacement', () => {
      expect(rainClosingBannerState(sunset(), 248.5)).toBe('closing-balance');
    });

    it('is the closable "nothing to withdraw" state when the card is empty', () => {
      expect(rainClosingBannerState(sunset(), 0)).toBe('closing-empty');
    });

    it('shows nothing when the notice is off and there is no new card', () => {
      expect(rainClosingBannerState(sunset({ notice: false }), 10)).toBeNull();
      expect(rainClosingBannerState(null, 10)).toBeNull();
    });
  });

  describe('copy', () => {
    it('never names the old issuer', () => {
      const texts = [
        homeBannerCopy('new-card', sunset({ newCardAvailable: true }), 10),
        homeBannerCopy('closing-balance', sunset(), 10),
        homeBannerCopy('closing-empty', sunset(), 0),
        cardNoticeCopy(sunset({ newCardAvailable: true }), 10),
        cardNoticeCopy(sunset(), 10, 'Egypt'),
      ].flatMap(({ title, message }) => [title, message]);
      for (const text of texts) expect(text).not.toMatch(/rain/i);
    });

    it('does not mention a current card to someone who never had one', () => {
      const { title, message } = homeBannerCopy(
        'new-card',
        sunset({ hasRainCard: false, newCardAvailable: true }),
        null,
      );
      expect(title).toBe('Get your Solid card');
      expect(message).not.toMatch(/current card/);
    });

    it('names the date and the balance on the banner', () => {
      expect(homeBannerCopy('closing-balance', sunset(), 248.5)).toEqual({
        title: 'Your card closes on Dec 7',
        message: 'Withdraw your $248.50 card balance before then.',
      });
    });

    it('tells a closing country the account keeps working', () => {
      const { title, message } = cardNoticeCopy(sunset(), 248.5, 'Egypt');
      expect(title).toBe('This card closes on December 7');
      expect(message).toContain("won't be available in Egypt after December 7");
      expect(message).toContain('Your Solid account keeps working as usual.');
    });

    it('offers the new card in the notice where it is available', () => {
      const { message } = cardNoticeCopy(sunset({ newCardAvailable: true }), 0);
      expect(message).toContain('Get your new Solid card now');
    });

    it('says "closing" with no announced date', () => {
      expect(cardNoticeCopy(sunset({ closesAt: null }), 0).title).toBe('This card is closing');
    });
  });

  describe('routesToNewCard', () => {
    const status = (rainSunset?: RainSunsetStatus): CardStatusResponse => ({ rainSunset });

    it('sends a Rain applicant with no card to the new card', () => {
      expect(routesToNewCard(status(sunset({ hasRainCard: false, newCardAvailable: true })))).toBe(
        true,
      );
    });

    it('leaves a cardholder on their card', () => {
      expect(routesToNewCard(status(sunset({ newCardAvailable: true })))).toBe(false);
    });

    it('does nothing where no new card is available and none was started', () => {
      expect(routesToNewCard(status(sunset({ hasRainCard: false })))).toBe(false);
      expect(routesToNewCard(status())).toBe(false);
    });
  });
});
