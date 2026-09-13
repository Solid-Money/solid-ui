import { CardProvider, KycStatus } from '@/lib/types';
import {
  canAddFundsToCard,
  canWithdrawFromCard,
  isCustomerFundsRestricted,
} from '@/lib/utils/cardHelpers';

/**
 * These two decide whether the card action row renders Add funds and Withdraw at
 * all, and they are deliberately not the same answer. The case that matters is a
 * frozen card: hiding Withdraw there left the cardholder no way to reach
 * collateral the API would have released, which is the whole reason the two were
 * split apart.
 */
describe('card funds access', () => {
  const live = { isCardFrozen: false, isCustomerRestricted: false };
  const frozen = { isCardFrozen: true, isCustomerRestricted: false };
  const restricted = { isCardFrozen: false, isCustomerRestricted: true };

  describe('canWithdrawFromCard', () => {
    it('offers Withdraw on a live card', () => {
      expect(canWithdrawFromCard(live)).toBe(true);
    });

    it('offers Withdraw on a frozen card', () => {
      // A freeze stops the card spending; the collateral proxy still pays out,
      // and the backend's withdraw endpoints don't check card status.
      expect(canWithdrawFromCard(frozen)).toBe(true);
    });

    it('hides Withdraw for a paused or offboarded customer', () => {
      expect(canWithdrawFromCard(restricted)).toBe(false);
      expect(canWithdrawFromCard({ isCardFrozen: true, isCustomerRestricted: true })).toBe(false);
    });

    it('hides Withdraw on a Wirex card, which holds no balance of its own', () => {
      // There is no collateral proxy behind a Wirex card and no backend
      // endpoint that would serve one, so the withdraw screen's Rain-only
      // collateral query never ran and the cardholder sat on "$0" with Max
      // greyed out. Their money comes out through the savings withdrawal.
      expect(canWithdrawFromCard({ ...live, provider: CardProvider.WIREX })).toBe(false);
    });

    it('offers Withdraw on a Rain card and before the issuer resolves', () => {
      expect(canWithdrawFromCard({ ...live, provider: CardProvider.RAIN })).toBe(true);
      // An unresolved issuer must not cost a Rain cardholder the action.
      expect(canWithdrawFromCard({ ...live, provider: null })).toBe(true);
      expect(canWithdrawFromCard({ ...live, provider: undefined })).toBe(true);
    });
  });

  describe('canAddFundsToCard', () => {
    it('offers Add funds on a live card', () => {
      expect(canAddFundsToCard(live)).toBe(true);
    });

    it('hides Add funds on a frozen card', () => {
      // Funding a card that can't spend only moves the balance somewhere worse.
      expect(canAddFundsToCard(frozen)).toBe(false);
    });

    it('hides Add funds for a paused or offboarded customer', () => {
      expect(canAddFundsToCard(restricted)).toBe(false);
    });
  });

  describe('isCustomerFundsRestricted', () => {
    it('restricts paused and offboarded customers', () => {
      expect(isCustomerFundsRestricted(KycStatus.PAUSED)).toBe(true);
      expect(isCustomerFundsRestricted(KycStatus.OFFBOARDED)).toBe(true);
    });

    it('leaves every other status alone', () => {
      expect(isCustomerFundsRestricted(KycStatus.APPROVED)).toBe(false);
      expect(isCustomerFundsRestricted(KycStatus.UNDER_REVIEW)).toBe(false);
      expect(isCustomerFundsRestricted(KycStatus.REJECTED)).toBe(false);
    });

    it('does not restrict before the customer has loaded', () => {
      // An unloaded customer is not a paused one — the row should render its
      // actions rather than drop columns and reflow once the query answers.
      expect(isCustomerFundsRestricted(undefined)).toBe(false);
      expect(isCustomerFundsRestricted(null)).toBe(false);
    });
  });
});
