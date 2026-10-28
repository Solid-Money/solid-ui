import { getRecentSendRecipients } from '@/lib/sendRecipients';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

function send(
  address: string,
  timestamp: string,
  overrides: Partial<ActivityEvent> = {},
): ActivityEvent {
  return {
    clientTxId: `${address}-${timestamp}`,
    title: 'Send',
    timestamp,
    type: TransactionType.SEND,
    status: TransactionStatus.SUCCESS,
    amount: '1',
    symbol: 'USDC',
    toAddress: address,
    chainId: 1,
    ...overrides,
  };
}

describe('recent send recipients', () => {
  it('sorts by latest send, deduplicates casing and excludes failed or incoming transfers', () => {
    expect(
      getRecentSendRecipients(
        [
          send('0xAbC', '100'),
          send('0xdef', '300'),
          send('0xabc', '200'),
          send('0xfailed', '500', { status: TransactionStatus.FAILED }),
          send('0xincoming', '600', { type: TransactionType.RECEIVE }),
          send('', '700'),
        ],
        [],
      ).map(recipient => recipient.walletAddress),
    ).toEqual(['0xdef', '0xabc']);
  });

  it('matches saved contacts without case sensitivity and preserves unsaved recipients', () => {
    expect(
      getRecentSendRecipients(
        [send('0xabc', '200'), send('0xdef', '100')],
        [{ walletAddress: '0xABC', name: 'Dana Lee', chainId: 8453 }],
      ),
    ).toEqual([
      { walletAddress: '0xabc', name: 'Dana Lee', chainId: 8453, saved: true },
      { walletAddress: '0xdef', name: undefined, chainId: 1, saved: false },
    ]);
  });

  it('uses the receiving network for a cross-chain recipient', () => {
    expect(
      getRecentSendRecipients(
        [
          send('0xabc', '100', {
            type: TransactionType.CROSS_CHAIN_SEND,
            metadata: { dstChainId: 42161 },
          }),
        ],
        [],
      )[0].chainId,
    ).toBe(42161);
  });
});
