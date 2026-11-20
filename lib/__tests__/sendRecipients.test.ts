import { ADDRESSES } from '@/lib/config';
import {
  getExpectedRecipientChainId,
  getRecentSendRecipients,
  isRecentSendActivity,
} from '@/lib/sendRecipients';
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

  it('never offers a backend smart account as a recipient', () => {
    // Deposit pulls from a Safe are indexed as sends to these accounts; two
    // users then sent their soUSD to the Connect-Wallet account (Nov 2026).
    const recipients = getRecentSendRecipients(
      [
        send('0x9e852a0d1bd9738d52b90a5e907138575822d69e', '300', { chainId: 56 }),
        send('0x54C11A6185907bC464fa6aCA0901Aea9DbDD08Fe', '250', { chainId: 8453 }),
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

describe('getExpectedRecipientChainId', () => {
  // sdelkin23, Oct 29 2026: 102 USDC bridged to Arbitrum for 0x0900…, then a
  // regular send of USDC on Base to the same address 41 seconds later.
  const arbitrumBridge = send('0x0900f6fccaac6193e40625e310099d1956b311d7', '200', {
    type: TransactionType.CROSS_CHAIN_SEND,
    chainId: 122,
    metadata: { dstChainId: 42161 },
  });

  it('expects the receiving network of the last send, whatever the casing', () => {
    expect(
      getExpectedRecipientChainId(
        '0x0900F6FccAac6193e40625E310099D1956B311d7',
        [
          send('0x0900f6fccaac6193e40625e310099d1956b311d7', '100', { chainId: 122 }),
          arbitrumBridge,
        ],
        [],
      ),
    ).toBe(42161);
  });

  it('prefers the network picked in the bridge flow, then a saved contact', () => {
    expect(getExpectedRecipientChainId('0xabc', [send('0xabc', '1')], [], 8453)).toBe(8453);
    expect(
      getExpectedRecipientChainId('0xabc', [], [{ walletAddress: '0xABC', chainId: 56 }]),
    ).toBe(56);
  });

  it('knows nothing about a new address', () => {
    expect(getExpectedRecipientChainId('0xnew', [arbitrumBridge], [])).toBeUndefined();
    expect(getExpectedRecipientChainId('', [arbitrumBridge], [])).toBeUndefined();
  });
});
