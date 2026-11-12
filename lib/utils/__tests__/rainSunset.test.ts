import {
  blocksNewCard,
  cardNoticeCopy,
  closesPhrase,
  floorCents,
  formatClosingBalance,
  formatClosingDate,
  hasClosingBalance,
  homeBannerCopy,
  isClosingBalanceUnknown,
  rainClosingBannerState,
  remainderCents,
  routesToNewCard,
  tokenWithdrawal,
  unitsToCents,
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

    it('never calls a balance it could not read empty', () => {
      expect(isClosingBalanceUnknown(null)).toBe(true);
      expect(isClosingBalanceUnknown(undefined)).toBe(true);
      expect(isClosingBalanceUnknown(0)).toBe(false);
      expect(rainClosingBannerState(sunset(), null)).toBe('closing-balance');
      expect(homeBannerCopy('closing-balance', sunset(), null).message).toBe(
        'Withdraw your card balance before then.',
      );
      expect(cardNoticeCopy(sunset(), null, 'Egypt').message).toContain(
        'Withdraw your card balance to your wallet before then.',
      );
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

  describe('cents', () => {
    it('reads whole cents from the figure, never across a cent boundary', () => {
      // (0.3 - 0.1) * 100 is exactly 20 in floating point; the figure is not.
      expect(floorCents(0.3 - 0.1)).toBe(19n);
      expect(floorCents(0.29)).toBe(29n);
      expect(floorCents(100.129)).toBe(10012n);
      expect(floorCents(248.5)).toBe(24850n);
      expect(floorCents(1e-7)).toBe(0n);
      expect(floorCents(-1)).toBe(0n);
      expect(floorCents(undefined)).toBe(0n);
    });

    it('rounds a token amount up for the cap it uses, down for what moved', () => {
      expect(unitsToCents(5000n, 6, 'up')).toBe(1n);
      expect(unitsToCents(5000n, 6, 'down')).toBe(0n);
      expect(unitsToCents(248500000n, 6, 'up')).toBe(24850n);
    });
  });

  describe('tokenWithdrawal', () => {
    const usdc = { rawBalance: '248500000', decimals: 6 };

    it('takes the whole balance when nothing caps it', () => {
      expect(tokenWithdrawal(usdc, undefined)).toEqual({ units: 248500000n, amount: '248.5' });
      expect(tokenWithdrawal(usdc, 30000n).amount).toBe('248.5');
    });

    it('takes a capped amount in the token’s own units', () => {
      expect(tokenWithdrawal(usdc, floorCents(100.129)).amount).toBe('100.12');
      expect(tokenWithdrawal(usdc, floorCents(0.3 - 0.1)).amount).toBe('0.19');
      expect(
        tokenWithdrawal({ decimals: 18, rawBalance: '248500000000000000000' }, 1234n).amount,
      ).toBe('12.34');
    });

    it('never asks for more than the token holds, or less than nothing', () => {
      expect(tokenWithdrawal({ rawBalance: '5000', decimals: 6 }, 999n).amount).toBe('0.005');
      expect(tokenWithdrawal(usdc, -1n)).toEqual({ units: 0n, amount: '0' });
    });
  });

  describe('remainderCents', () => {
    const usdc = { rawBalance: '248500000', decimals: 6 };

    it('is what a capped withdrawal leaves on the card', () => {
      const { units } = tokenWithdrawal(usdc, floorCents(100.12));
      expect(remainderCents(usdc, units)).toBe(14838n);
    });

    it('is the whole balance for a token the cap never reached', () => {
      expect(remainderCents(usdc, 0n)).toBe(24850n);
    });

    it('is nothing once the whole balance moved, dust included', () => {
      expect(remainderCents(usdc, 248500000n)).toBe(0n);
      expect(remainderCents({ rawBalance: '248505000', decimals: 6 }, 248500000n)).toBe(0n);
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
