/// <reference types="jest" />
import { getTransactionCategory, isSourceReceiptFinalizable } from '@/constants/transaction';
import {
  ActivityEvent,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { deduplicateTransactions } from '@/lib/utils/deduplicateTransactions';

function makeActivity(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    clientTxId: 'tx-1',
    type: TransactionType.CARD_DEPOSIT,
    status: TransactionStatus.SUCCESS,
    amount: '0.01',
    symbol: 'USDC',
    timestamp: '1781426763',
    title: 'Deposit to Card',
    ...overrides,
  } as ActivityEvent;
}

describe('deduplicateTransactions — connect-wallet card deposit', () => {
  // Real shape from a Wallet-source Rain card deposit: the frontend creates the
  // base trackingId activity (with the on-chain hash) and the backend Temporal
  // workflow creates `${trackingId}_card`. They must render as ONE row.
  const frontend = makeActivity({
    clientTxId: 'mqdjhtjp-g038q1a0',
    title: 'Deposit USDC to Card',
    userOpHash: '0x92d8602bde4171b6686544d4d2fa61ba0b5db07cb4458da85a94ae6347a1b527',
    hash: '0x7843ea7492494d0adfb3b913c6bfb2f87daf5a6f6714a12df6c79387d60664cb',
    toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
    metadata: { source: 'transaction-hook' },
  });
  const backendCard = makeActivity({
    clientTxId: 'mqdjhtjp-g038q1a0_card',
    title: 'Deposit to Card',
    userOpHash: '0x4acf1672858e422d8a760b2ffde946f3ad90d4bfe0965a77d8e2150bf9f665f3',
    toAddress: '0xcf06a945cecc2651b78d055b6246ae1622c9e966',
    metadata: {},
  });

  it('collapses trackingId and trackingId_card into a single row', () => {
    const result = deduplicateTransactions([backendCard, frontend]);
    expect(result).toHaveLength(1);
  });

  it('keeps the row carrying the on-chain hash (the explorer link)', () => {
    const result = deduplicateTransactions([backendCard, frontend]);
    expect(result[0].clientTxId).toBe('mqdjhtjp-g038q1a0');
    expect(result[0].hash).toBe(frontend.hash);
  });

  it('still keeps a savings deposit and its _savings step separate', () => {
    const base = makeActivity({
      clientTxId: 'dep-1',
      type: TransactionType.DEPOSIT,
      title: 'Deposit USDC',
      hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    });
    const savings = makeActivity({
      clientTxId: 'dep-1_savings',
      type: TransactionType.DEPOSIT,
      title: 'Deposit soUSD to Savings',
    });
    const result = deduplicateTransactions([base, savings]);
    expect(result).toHaveLength(2);
  });
});

describe('getTransactionCategory', () => {
  it('labels a card-bound bridge_deposit as Card deposit', () => {
    expect(getTransactionCategory(TransactionType.BRIDGE_DEPOSIT, 'Deposit soUSD to Card')).toBe(
      TransactionCategory.CARD_DEPOSIT,
    );
  });

  it('leaves a real bridge_deposit as External wallet transfer', () => {
    expect(getTransactionCategory(TransactionType.BRIDGE_DEPOSIT, 'Bridge to Arbitrum')).toBe(
      TransactionCategory.EXTERNAL_WALLET_TRANSFER,
    );
  });

  it('falls back to the static category for other types', () => {
    expect(getTransactionCategory(TransactionType.CARD_TRANSACTION, 'Card Deposit')).toBe(
      TransactionCategory.CARD_DEPOSIT,
    );
    expect(getTransactionCategory(TransactionType.SEND, 'Sent USDC')).toBe(
      TransactionCategory.WALLET_TRANSFER,
    );
  });
});

describe('isSourceReceiptFinalizable', () => {
  // Cross-chain card deposits must NOT be marked complete on their source-chain
  // receipt — they bridge for minutes and finalize via the Rain webhook.
  it('is false for cross-chain card deposit types', () => {
    expect(isSourceReceiptFinalizable(TransactionType.BRIDGE_DEPOSIT)).toBe(false);
    expect(isSourceReceiptFinalizable(TransactionType.BORROW_AND_DEPOSIT_TO_CARD)).toBe(false);
    expect(isSourceReceiptFinalizable(TransactionType.CARD_DEPOSIT)).toBe(false);
  });

  it('is true for same-chain types resolved by a source-chain receipt', () => {
    expect(isSourceReceiptFinalizable(TransactionType.SEND)).toBe(true);
    expect(isSourceReceiptFinalizable(TransactionType.CARD_TRANSACTION)).toBe(true);
  });
});
