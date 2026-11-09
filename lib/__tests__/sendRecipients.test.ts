import { ADDRESSES } from '@/lib/config';
import { getRecentSendRecipients, isRecentSendActivity } from '@/lib/sendRecipients';
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

  it('never offers a BridgePaymaster as a recipient, whatever the casing or chain', () => {
    // A bridge's Fuse leg is indexed as a plain send to the paymaster; it was
    // offered as the latest recipient and a Base send went to it.
    const recipients = getRecentSendRecipients(
      [
        send(ADDRESSES.fuse.bridgePaymasterAddress.toLowerCase(), '300', { chainId: 122 }),
        send(ADDRESSES.ethereum.bridgePaymasterAddress, '250', { chainId: 1 }),
        send('0xabc', '100'),
      ],
      [],
    );
    expect(recipients.map(recipient => recipient.walletAddress)).toEqual(['0xabc']);
  });
});

describe('isRecentSendActivity', () => {
  it('accepts a successful send to someone and rejects a paymaster leg', () => {
    expect(isRecentSendActivity(send('0xabc', '1'))).toBe(true);
    expect(isRecentSendActivity(send(ADDRESSES.fuse.bridgePaymasterAddress, '1'))).toBe(false);
  });
});
