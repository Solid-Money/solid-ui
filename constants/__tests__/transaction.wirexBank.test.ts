import { getTransactionCategory, TRANSACTION_DETAILS } from '@/constants/transaction';
import { TransactionCategory, TransactionDirection, TransactionType } from '@/lib/types';

/**
 * A type absent from TRANSACTION_DETAILS renders with no sign and a category of
 * "Unknown", and reports an exception to Sentry from both the list row and the
 * detail screen. The backend emits these two types, so they have to resolve.
 */
describe('Wirex bank transaction types', () => {
  it('shows an inbound SEPA/ACH deposit as money coming in', () => {
    expect(TRANSACTION_DETAILS[TransactionType.WIREX_BANK_DEPOSIT]).toEqual({
      sign: TransactionDirection.IN,
      category: TransactionCategory.BANK_DEPOSIT,
    });
  });

  it('shows an outbound transfer as money going out', () => {
    // The whole reason these are not BANK_TRANSFER: that type is hard-coded
    // inbound, so a payout under it would render with a "+".
    expect(TRANSACTION_DETAILS[TransactionType.WIREX_BANK_PAYOUT].sign).toBe(
      TransactionDirection.OUT,
    );
  });

  it('labels a payout as a bank withdrawal, not a bank deposit', () => {
    expect(getTransactionCategory(TransactionType.WIREX_BANK_PAYOUT)).toBe(
      TransactionCategory.BANK_WITHDRAWAL,
    );
  });

  it('resolves a category for both, so neither falls back to "Unknown"', () => {
    expect(getTransactionCategory(TransactionType.WIREX_BANK_DEPOSIT)).toBeDefined();
    expect(getTransactionCategory(TransactionType.WIREX_BANK_PAYOUT)).toBeDefined();
  });

  it('keeps the Bridge rail on its own type', () => {
    // ActivityTransactions opens the Bridge transfer-preview modal on a tap on
    // BANK_TRANSFER; a Wirex activity carries no Bridge deposit instructions.
    expect(TransactionType.WIREX_BANK_DEPOSIT).not.toBe(TransactionType.BANK_TRANSFER);
    expect(TransactionType.WIREX_BANK_PAYOUT).not.toBe(TransactionType.BANK_TRANSFER);
  });
});
