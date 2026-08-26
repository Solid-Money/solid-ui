/// <reference types="jest" />
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { deduplicateTransactions } from '@/lib/utils/deduplicateTransactions';

function makeActivity(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    clientTxId: 'tx-1',
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.SUCCESS,
    amount: '1.5',
    symbol: 'USDC',
    timestamp: '1781426763',
    title: 'Deposit USDC',
    ...overrides,
  } as ActivityEvent;
}

const HASH_A = '0xaaa1111111111111111111111111111111111111111111111111111111111111';
const HASH_B = '0xbbb2222222222222222222222222222222222222222222222222222222222222';

// The rows are matched through an identifier index rather than a scan over every
// row already kept, so each route into that index needs its own case.
describe('deduplicateTransactions — identifier matching', () => {
  it('collapses rows sharing a tx hash, whatever the casing', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'a', hash: HASH_A }),
      makeActivity({ clientTxId: 'b', hash: HASH_A.toUpperCase() }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('collapses a hash against the other row’s metadata.txHash', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'a', hash: HASH_A }),
      makeActivity({ clientTxId: 'b', metadata: { txHash: HASH_A } }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('collapses a hash against the other row’s userOpHash', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'a', userOpHash: HASH_A }),
      makeActivity({ clientTxId: 'b', hash: HASH_A }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('collapses a hash against the other row’s clientTxId', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: HASH_A }),
      makeActivity({ clientTxId: 'b', hash: HASH_A }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('collapses rows sharing only a userOpHash', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'a', userOpHash: HASH_A }),
      makeActivity({ clientTxId: 'b', userOpHash: HASH_A }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('leaves rows with no identifier in common alone', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'a', hash: HASH_A }),
      makeActivity({ clientTxId: 'b', hash: HASH_B }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('keeps a _savings step the index turned up as a candidate separate', () => {
    // Different dedup keys, overlapping hashes — so the veto inside isDuplicate
    // is what has to hold the two apart, not the keys.
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'dep-1', hash: HASH_A }),
      makeActivity({ clientTxId: 'dep-1_savings', hash: HASH_B, metadata: { txHash: HASH_A } }),
    ]);

    expect(result).toHaveLength(2);
  });

  it('collapses a _savings pair that resolves to one dedup key', () => {
    // Long-standing behaviour, kept deliberately: with no hash on either row the
    // shared userOpHash *is* the dedup key, and a key collision merges without
    // consulting the _savings veto.
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'dep-1', userOpHash: HASH_A }),
      makeActivity({ clientTxId: 'dep-1_savings', userOpHash: HASH_A }),
    ]);

    expect(result).toHaveLength(1);
  });

  it('still collapses a _card sibling that shares no hash at all', () => {
    const result = deduplicateTransactions([
      makeActivity({ clientTxId: 'trk-1_card', userOpHash: HASH_B }),
      makeActivity({ clientTxId: 'trk-1', hash: HASH_A }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].clientTxId).toBe('trk-1');
  });
});

describe('deduplicateTransactions — card-funding SEND rows', () => {
  const cardAddress = '0x9e852a0d1bd9738d52b90a5e907138575822d69e';

  const send = makeActivity({
    clientTxId: 'send-1',
    type: TransactionType.SEND,
    hash: HASH_A,
    toAddress: cardAddress,
    timestamp: '1781426763',
  });

  it('drops the SEND when a bridge deposit funds the same address minutes apart', () => {
    const bridge = makeActivity({
      clientTxId: 'bridge-1',
      type: TransactionType.BRIDGE_DEPOSIT,
      hash: HASH_B,
      toAddress: cardAddress,
      timestamp: '1781426800',
    });

    const result = deduplicateTransactions([send, bridge]);

    expect(result.map(tx => tx.clientTxId)).toEqual(['bridge-1']);
  });

  it('keeps the SEND when the bridge deposit is outside the window', () => {
    const bridge = makeActivity({
      clientTxId: 'bridge-1',
      type: TransactionType.BRIDGE_DEPOSIT,
      hash: HASH_B,
      toAddress: cardAddress,
      timestamp: '1781430000',
    });

    expect(deduplicateTransactions([send, bridge])).toHaveLength(2);
  });

  it('keeps the SEND when the bridge deposit went somewhere else', () => {
    const bridge = makeActivity({
      clientTxId: 'bridge-1',
      type: TransactionType.BRIDGE_DEPOSIT,
      hash: HASH_B,
      toAddress: '0x0000000000000000000000000000000000000dead',
      timestamp: '1781426800',
    });

    expect(deduplicateTransactions([send, bridge])).toHaveLength(2);
  });
});

describe('deduplicateTransactions — Fuse→Ethereum withdraw flow', () => {
  const safe = '0x1111111111111111111111111111111111111111';

  const bridge = makeActivity({
    clientTxId: 'bridge-1',
    type: TransactionType.BRIDGE_DEPOSIT,
    hash: HASH_A,
    fromAddress: safe,
    amount: '10',
    timestamp: '1781426763',
  });

  it('hides the bridge leg when its withdraw counterpart exists', () => {
    const withdraw = makeActivity({
      clientTxId: 'withdraw-1',
      type: TransactionType.WITHDRAW,
      hash: HASH_B,
      fromAddress: safe,
      amount: '10',
      timestamp: '1781427763',
    });

    expect(deduplicateTransactions([bridge, withdraw]).map(tx => tx.clientTxId)).toEqual([
      'withdraw-1',
    ]);
  });

  it('keeps the bridge leg when the amounts differ', () => {
    const withdraw = makeActivity({
      clientTxId: 'withdraw-1',
      type: TransactionType.WITHDRAW,
      hash: HASH_B,
      fromAddress: safe,
      amount: '11',
      timestamp: '1781427763',
    });

    expect(deduplicateTransactions([bridge, withdraw])).toHaveLength(2);
  });
});

describe('deduplicateTransactions — cost', () => {
  // This used to compare every incoming row against every row already kept,
  // which at the store's 500-event cap meant ~125k comparisons — and it ran on
  // every render of the activity list, in every mounted copy of it. The budget
  // is far above what the indexed version needs (single-digit ms) and far below
  // what the old scan took, so a regression here fails loudly.
  it('handles a full history well inside a frame budget', () => {
    const history = Array.from({ length: 1000 }, (_, index) => {
      const hex = index.toString(16).padStart(6, '0');
      return makeActivity({
        clientTxId: `tracking-${hex}`,
        type: index % 5 === 0 ? TransactionType.SEND : TransactionType.DEPOSIT,
        hash: `0x${hex.repeat(10)}`,
        userOpHash: `0x${hex.repeat(10)}ff`,
        toAddress: `0x${(index % 7).toString().repeat(40)}`,
        fromAddress: `0x${(index % 3).toString().repeat(40)}`,
        timestamp: String(1781426763 - index * 900),
      });
    });

    const start = performance.now();
    const result = deduplicateTransactions(history);
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(1000);
    expect(elapsed).toBeLessThan(150);
  });
});
