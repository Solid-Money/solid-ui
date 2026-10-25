import {
  canFinalizeFromSourceReceipt,
  CROSS_CHAIN_DEPOSIT_METADATA_KEY,
  DELIVERED_BY_BACKEND_METADATA_KEY,
} from '@/constants/transaction';
import {
  amountOnItsWay,
  DEPOSIT_FAILED_SHOWN_MS,
  DEPOSIT_TAKING_LONGER_MS,
  depositsOnItsWay,
  getDepositOnItsWay,
  hasDepositMoving,
  nextDepositChangeAt,
} from '@/lib/deposit/depositOnItsWay';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

const SENT_AT = Date.UTC(2026, 9, 21, 12, 0, 0);
const MINUTE = 60 * 1000;

/** A $100 USD Yield deposit from the Solid wallet, as useDepositFromSolidUsdc records it. */
const deposit = (
  overrides: Partial<ActivityEvent> = {},
  metadata: Record<string, unknown> = {},
): ActivityEvent => ({
  clientTxId: 'deposit-1',
  title: 'Deposit USDC',
  timestamp: String(SENT_AT / 1000),
  type: TransactionType.DEPOSIT,
  status: TransactionStatus.PROCESSING,
  amount: '100',
  symbol: 'USDC',
  ...overrides,
  metadata: {
    [DELIVERED_BY_BACKEND_METADATA_KEY]: true,
    vaultShareSymbol: 'soUSD',
    ...metadata,
  },
});

const stateAt = (activity: ActivityEvent, minutes: number) =>
  getDepositOnItsWay(activity, SENT_AT + minutes * MINUTE)?.state;

describe('getDepositOnItsWay', () => {
  it.each([TransactionStatus.PENDING, TransactionStatus.DETECTED, TransactionStatus.PROCESSING])(
    'is on its way while the row is %s',
    status => {
      expect(getDepositOnItsWay(deposit({ status }), SENT_AT + MINUTE)).toEqual({
        clientTxId: 'deposit-1',
        amount: 100,
        state: 'on_its_way',
        sentAt: SENT_AT,
      });
    },
  );

  it('is taking longer from 30 minutes on', () => {
    expect(stateAt(deposit(), 29)).toBe('on_its_way');
    expect(stateAt(deposit(), 30)).toBe('taking_longer');
    expect(stateAt(deposit(), 120)).toBe('taking_longer');
  });

  it('is not on its way when the backend call failed: the USDC may still be in the wallet', () => {
    expect(stateAt(deposit({}, { depositError: 'Backend returned error' }), 1)).toBeUndefined();
    expect(stateAt(deposit({}, { depositError: 'Backend returned error' }), 45)).toBeUndefined();
  });

  it("says a failed deposit didn't go through, for a day", () => {
    const failed = deposit({ status: TransactionStatus.FAILED });
    expect(stateAt(failed, 1)).toBe('failed');
    expect(getDepositOnItsWay(failed, SENT_AT + DEPOSIT_FAILED_SHOWN_MS)).toBeUndefined();
  });

  it('drops a deposit the user cancelled, or one that landed', () => {
    expect(stateAt(deposit({ status: TransactionStatus.CANCELLED }), 1)).toBeUndefined();
    expect(
      stateAt(deposit({ status: TransactionStatus.SUCCESS }, { depositStep: 'complete' }), 1),
    ).toBeUndefined();
  });

  // The backend monitor marks a same-chain deposit SUCCESS from its approve receipt,
  // before the workflow has moved any funds; only the `complete` step means it landed.
  it('keeps a same-chain deposit marked SUCCESS early on its way until the complete step', () => {
    const early = deposit({ status: TransactionStatus.SUCCESS }, { depositStep: 'confirmed' });
    expect(stateAt(early, 2)).toBe('on_its_way');
    expect(stateAt(deposit({ status: TransactionStatus.SUCCESS }), 2)).toBe('on_its_way');
    // Past the taking-longer mark the SUCCESS is believed: the step may never have reached us.
    expect(stateAt(early, 30)).toBeUndefined();
  });

  it('takes a cross-chain SUCCESS as it is: the bridge workflow writes no steps', () => {
    const bridged = deposit(
      { status: TransactionStatus.SUCCESS },
      { [CROSS_CHAIN_DEPOSIT_METADATA_KEY]: true },
    );
    expect(stateAt(bridged, 2)).toBeUndefined();
  });

  it('follows only USD Yield deposits from the Solid wallet', () => {
    const card = deposit({ type: TransactionType.CARD_DEPOSIT });
    const ethYield = deposit({}, { vaultShareSymbol: 'soETH' });
    // A direct deposit into USD Yield carries the share symbol but not the hook's flag.
    const direct = deposit({}, { [DELIVERED_BY_BACKEND_METADATA_KEY]: undefined });
    expect(stateAt(card, 1)).toBeUndefined();
    expect(stateAt(ethYield, 1)).toBeUndefined();
    expect(stateAt(direct, 1)).toBeUndefined();
    expect(stateAt(deposit({ deleted: true }), 1)).toBeUndefined();
  });
});

describe('depositsOnItsWay', () => {
  const activities = [
    deposit({ clientTxId: 'older', amount: '50', timestamp: String(SENT_AT / 1000 - 600) }),
    deposit({ clientTxId: 'newer', amount: '100' }),
    deposit({ clientTxId: 'failed', amount: '25', status: TransactionStatus.FAILED }),
    deposit({ clientTxId: 'errored', amount: '10' }, { depositError: 'timeout' }),
  ];
  const deposits = depositsOnItsWay(activities, SENT_AT + MINUTE);

  it('lists them newest first', () => {
    expect(deposits.map(item => item.clientTxId)).toEqual(['newer', 'failed', 'older']);
  });

  it('adds up only what is still moving', () => {
    expect(amountOnItsWay(deposits)).toBe(150);
    expect(hasDepositMoving(deposits)).toBe(true);
    expect(hasDepositMoving(deposits.filter(item => item.state === 'failed'))).toBe(false);
  });

  it('knows when a row next changes on its own', () => {
    // "older" was sent 10 minutes earlier, so it turns "taking longer" first.
    expect(nextDepositChangeAt(deposits)).toBe(SENT_AT - 10 * MINUTE + DEPOSIT_TAKING_LONGER_MS);
    expect(
      nextDepositChangeAt(depositsOnItsWay([deposit()], SENT_AT + 31 * MINUTE)),
    ).toBeUndefined();
  });
});

describe('canFinalizeFromSourceReceipt for a deposit the backend delivers', () => {
  // Its only transaction is the approve, so the receipt must not complete it, on Ethereum too.
  it('is false for a same-chain deposit flagged as delivered by the backend', () => {
    expect(canFinalizeFromSourceReceipt(deposit())).toBe(false);
    expect(canFinalizeFromSourceReceipt({ type: TransactionType.DEPOSIT })).toBe(true);
  });
});
