/// <reference types="jest" />
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import {
  getTransferCategory,
  getTransferContext,
  getTransferSummary,
  getTransferTitle,
  isDepositDeliveryActivity,
  TransferContextKind,
} from '@/lib/utils/transferPresentation';

const SAFE = '0x5f84b1e86e899fbef98d90573fc17437d5049fee';
const FRIEND = '0xcD070Dce63cCDd1D726c71b458fD159237090271';
const PAYOUT_WALLET = '0x867898c447effd26530c84993c48b2a2a7e9646c';

const activity = (overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({
    clientTxId: 'blockscout_122_0xabc_outgoing',
    title: 'Send USDC.e',
    timestamp: '1792657505',
    type: TransactionType.SEND,
    status: TransactionStatus.SUCCESS,
    amount: '10.5',
    symbol: 'USDC.e',
    fromAddress: SAFE,
    toAddress: FRIEND,
    metadata: {},
    ...overrides,
  }) as ActivityEvent;

const refund = (overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
  activity({
    type: TransactionType.RECEIVE,
    title: 'Refund from UBER',
    fromAddress: PAYOUT_WALLET,
    toAddress: SAFE,
    metadata: {
      transferContext: {
        kind: TransferContextKind.CARD_REFUND,
        summary:
          'UBER cancelled a card payment, so the money came back. It was paid back into your wallet in USDC.e.',
        merchantName: 'UBER',
      },
    },
    ...overrides,
  });

describe('getTransferTitle', () => {
  it('names a plain send by who it went to', () => {
    expect(getTransferTitle(activity())).toBe('Sent to 0xcD07...0271');
  });

  it('uses the contact name when the address is saved', () => {
    const contacts = new Map([[FRIEND.toLowerCase(), 'Alice']]);

    expect(getTransferTitle(activity(), contacts)).toBe('Sent to Alice');
  });

  it('names a plain receive by who sent it', () => {
    expect(
      getTransferTitle(
        activity({
          type: TransactionType.RECEIVE,
          title: 'Receive EURC',
          fromAddress: FRIEND,
          toAddress: SAFE,
        }),
      ),
    ).toBe('Received from 0xcD07...0271');
  });

  it('recognises the app’s own "Send 10 USDC" title as plain too', () => {
    expect(getTransferTitle(activity({ title: 'Send 10.5 USDC' }))).toBe('Sent to 0xcD07...0271');
  });

  it('does not say "sent" for a send that is still going or did not happen', () => {
    expect(getTransferTitle(activity({ status: TransactionStatus.PENDING }))).toBe(
      'Sending to 0xcD07...0271',
    );
    expect(getTransferTitle(activity({ status: TransactionStatus.FAILED }))).toBe(
      'Send to 0xcD07...0271',
    );
  });

  it('keeps the name the backend gave a transfer it recognised', () => {
    expect(getTransferTitle(refund())).toBe('Refund from UBER');
  });

  it('keeps a title someone wrote on purpose', () => {
    expect(getTransferTitle(activity({ title: 'Deposit USDC to Card' }))).toBe(
      'Deposit USDC to Card',
    );
  });

  it('leaves every other type alone', () => {
    expect(getTransferTitle(activity({ type: TransactionType.SWAP, title: 'Send USDC' }))).toBe(
      'Send USDC',
    );
  });

  it('names a transfer with no stored title by its counterparty too', () => {
    expect(getTransferTitle(activity({ title: '' }))).toBe('Sent to 0xcD07...0271');
  });

  it('keeps the stored title when the row has no counterparty', () => {
    expect(getTransferTitle(activity({ toAddress: undefined }))).toBe('Send USDC.e');
  });
});

describe('getTransferCategory', () => {
  it('reads "Card refund" for a refund rather than "Receive"', () => {
    expect(getTransferCategory(refund())).toBe('Card refund');
  });

  it('has nothing to say about a transfer the backend did not recognise', () => {
    expect(getTransferCategory(activity())).toBeUndefined();
  });
});

describe('getTransferSummary', () => {
  it('uses the backend’s sentence for a recognised transfer', () => {
    expect(getTransferSummary(refund())).toBe(
      'UBER cancelled a card payment, so the money came back. It was paid back into your wallet in USDC.e.',
    );
  });

  it('says who sent what for a plain receive', () => {
    expect(
      getTransferSummary(
        activity({
          type: TransactionType.RECEIVE,
          title: 'Receive USDC.E',
          symbol: 'USDC.E',
          fromAddress: FRIEND,
          toAddress: SAFE,
        }),
      ),
    ).toBe('0xcD07...0271 sent 10.50 USDC.e to your wallet.');
  });

  it('says what was sent and to whom for a plain send', () => {
    const contacts = new Map([[FRIEND.toLowerCase(), 'Alice']]);

    expect(getTransferSummary(activity(), contacts)).toBe(
      'You sent 10.50 USDC.e from your wallet to Alice.',
    );
    expect(getTransferSummary(activity({ status: TransactionStatus.FAILED }), contacts)).toBe(
      'Your send of 10.50 USDC.e to Alice did not go through.',
    );
  });

  it('shows the amount’s own digits, cut rather than rounded through a float', () => {
    expect(getTransferSummary(activity({ amount: '1.2345678' }))).toBe(
      'You sent 1.234567 USDC.e from your wallet to 0xcD07...0271.',
    );
  });

  it('has nothing to say about other types', () => {
    expect(getTransferSummary(activity({ type: TransactionType.SWAP }))).toBeUndefined();
  });
});

describe('getTransferContext', () => {
  it('drops a field that is not text, so it can never reach a text node', () => {
    const context = getTransferContext(
      refund({
        metadata: {
          transferContext: {
            kind: TransferContextKind.CARD_REFUND,
            summary: { not: 'text' },
            merchantName: 42,
          },
        },
      }),
    );

    expect(context).toEqual(expect.objectContaining({ kind: TransferContextKind.CARD_REFUND }));
    expect(context?.summary).toBeUndefined();
    expect(context?.merchantName).toBeUndefined();
  });

  it('ignores a kind this build does not know, rather than trusting it', () => {
    expect(
      getTransferContext(activity({ metadata: { transferContext: { kind: 'something_new' } } })),
    ).toBeUndefined();
  });
});

describe('isDepositDeliveryActivity', () => {
  it('flags the delivery of a deposit that has its own row', () => {
    expect(
      isDepositDeliveryActivity(
        activity({
          type: TransactionType.RECEIVE,
          metadata: {
            transferContext: {
              kind: TransferContextKind.DEPOSIT_DELIVERY,
              linkedClientTxId: 'direct_deposit_u_8453_EURC_1',
            },
          },
        }),
      ),
    ).toBe(true);
  });

  it('keeps a refund and a plain receive in the feed', () => {
    expect(isDepositDeliveryActivity(refund())).toBe(false);
    expect(isDepositDeliveryActivity(activity({ type: TransactionType.RECEIVE }))).toBe(false);
  });
});
