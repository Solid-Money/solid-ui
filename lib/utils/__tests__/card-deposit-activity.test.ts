/// <reference types="jest" />
import { getTransactionCategory, isSourceReceiptFinalizable } from '@/constants/transaction';
import {
  ActivityEvent,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import {
  deduplicateTransactions,
  resolveCardDepositTransferTx,
} from '@/lib/utils/deduplicateTransactions';

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

  it('removes the Blockscout-synced Send that mirrors a Wallet→card deposit', () => {
    // Real shape: the frontend card_deposit (approve userOp hash) and the
    // Blockscout-synced "Send USDC" (the on-chain transfer hash) share the same
    // card funding toAddress + timestamp but have different hashes.
    const cardDeposit = makeActivity({
      clientTxId: 'mqdtqm1z-0xxndjzj',
      title: 'Deposit USDC to Card',
      hash: '0x1e6e5edd8850a6d072aa7cb592843b2638c1604b1a48b0cfdffc9ea56456cfe7',
      userOpHash: '0x5f5b9152b8ef76d3b55adc363efbe5cf7fcda5643eb02e74339be32531473553',
      toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
      metadata: { source: 'transaction-hook' },
    });
    const blockscoutSend = makeActivity({
      clientTxId: 'blockscout_8453_0xeb41_outgoing',
      type: TransactionType.SEND,
      title: 'Send USDC',
      shortTitle: 'Send',
      hash: '0xeb41c0c152e3183d217a60ccae5ab5a4818366bdca58149e71e9b8172688733d',
      toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
      metadata: { source: 'blockscout' },
    });
    const result = deduplicateTransactions([blockscoutSend, cardDeposit]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(TransactionType.CARD_DEPOSIT);
  });

  it('keeps an unrelated Send to a different address', () => {
    const cardDeposit = makeActivity({
      clientTxId: 'dep-x',
      toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
      hash: '0xaaaa000000000000000000000000000000000000000000000000000000000001',
    });
    const unrelatedSend = makeActivity({
      clientTxId: 'send-x',
      type: TransactionType.SEND,
      title: 'Send USDC',
      toAddress: '0x1111111111111111111111111111111111111111',
      hash: '0xbbbb000000000000000000000000000000000000000000000000000000000002',
    });
    const result = deduplicateTransactions([cardDeposit, unrelatedSend]);
    expect(result).toHaveLength(2);
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

describe('resolveCardDepositTransferTx', () => {
  const cardDeposit = makeActivity({
    clientTxId: 'mqdtqm1z-0xxndjzj',
    title: 'Deposit USDC to Card',
    hash: '0x1e6e5edd8850a6d072aa7cb592843b2638c1604b1a48b0cfdffc9ea56456cfe7', // approve userOp
    toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
  });
  const transferSend = makeActivity({
    clientTxId: 'blockscout_8453_0xeb41_outgoing',
    type: TransactionType.SEND,
    title: 'Send USDC',
    hash: '0xeb41c0c152e3183d217a60ccae5ab5a4818366bdca58149e71e9b8172688733d', // real transfer
    toAddress: '0x9e852a0d1bd9738d52b90a5e907138575822d69e',
    url: 'https://base.blockscout.com/tx/0xeb41c0c152e3183d217a60ccae5ab5a4818366bdca58149e71e9b8172688733d',
  });

  it('returns the sibling Send transfer tx (hash + url) for a card deposit', () => {
    const result = resolveCardDepositTransferTx(cardDeposit, [cardDeposit, transferSend]);
    expect(result).toEqual({ hash: transferSend.hash, url: transferSend.url });
  });

  it('returns undefined when there is no sibling transfer', () => {
    expect(resolveCardDepositTransferTx(cardDeposit, [cardDeposit])).toBeUndefined();
  });

  it('returns undefined for non card-deposit types', () => {
    const send = makeActivity({ clientTxId: 's', type: TransactionType.SEND });
    expect(resolveCardDepositTransferTx(send, [send, transferSend])).toBeUndefined();
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
