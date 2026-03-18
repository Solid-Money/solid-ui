/// <reference types="jest" />
import {
  ActivityEvent,
  TransactionStatus,
  TransactionType,
  DepositStep,
} from '@/lib/types';
import {
  DEPOSIT_STEPS,
  getDepositStep,
  getDepositStepIndex,
  getDepositStepDescription,
  isDepositWithSteps,
} from '@/lib/utils/deposit-steps';

/**
 * Factory for building minimal ActivityEvent fixtures.
 * Only the fields relevant to deposit-step logic are required;
 * everything else is given a safe default.
 */
function makeActivity(
  overrides: Partial<ActivityEvent> & { type: TransactionType; status: TransactionStatus },
): ActivityEvent {
  return {
    clientTxId: 'test-tx-1',
    title: 'Test',
    timestamp: new Date().toISOString(),
    amount: '100',
    symbol: 'USDC',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDepositStep
// ---------------------------------------------------------------------------
describe('getDepositStep', () => {
  describe('when metadata.depositStep is set explicitly', () => {
    const steps: DepositStep[] = ['detected', 'confirmed', 'depositing', 'minting', 'complete'];

    it.each(steps)('returns "%s" from metadata regardless of status', (step) => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING, // status should be ignored
        metadata: { depositStep: step },
      });
      expect(getDepositStep(activity)).toBe(step);
    });
  });

  describe('fallback inference from status (no metadata.depositStep)', () => {
    it('returns "complete" for SUCCESS status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
      });
      expect(getDepositStep(activity)).toBe('complete');
    });

    it('returns "confirmed" for PROCESSING status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PROCESSING,
      });
      expect(getDepositStep(activity)).toBe('confirmed');
    });

    it('returns "detected" for PENDING status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
      });
      expect(getDepositStep(activity)).toBe('detected');
    });

    it('returns undefined for FAILED status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.FAILED,
      });
      expect(getDepositStep(activity)).toBeUndefined();
    });

    it('returns undefined for CANCELLED status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.CANCELLED,
      });
      expect(getDepositStep(activity)).toBeUndefined();
    });

    it('returns undefined for EXPIRED status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.EXPIRED,
      });
      expect(getDepositStep(activity)).toBeUndefined();
    });

    it('returns undefined for REFUNDED status', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.REFUNDED,
      });
      expect(getDepositStep(activity)).toBeUndefined();
    });
  });

  describe('when metadata exists but depositStep is absent', () => {
    it('falls back to status inference', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.SUCCESS,
        metadata: { someOtherField: true },
      });
      expect(getDepositStep(activity)).toBe('complete');
    });
  });

  describe('when metadata is undefined', () => {
    it('falls back to status inference', () => {
      const activity = makeActivity({
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PROCESSING,
        metadata: undefined,
      });
      expect(getDepositStep(activity)).toBe('confirmed');
    });
  });
});

// ---------------------------------------------------------------------------
// isDepositWithSteps
// ---------------------------------------------------------------------------
describe('isDepositWithSteps', () => {
  it('returns true for DEPOSIT type', () => {
    const activity = makeActivity({
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
    });
    expect(isDepositWithSteps(activity)).toBe(true);
  });

  it('returns true for BRIDGE_DEPOSIT type', () => {
    const activity = makeActivity({
      type: TransactionType.BRIDGE_DEPOSIT,
      status: TransactionStatus.PENDING,
    });
    expect(isDepositWithSteps(activity)).toBe(true);
  });

  const nonDepositTypes: TransactionType[] = [
    TransactionType.WITHDRAW,
    TransactionType.SEND,
    TransactionType.RECEIVE,
    TransactionType.BRIDGE,
    TransactionType.SWAP,
    TransactionType.UNSTAKE,
    TransactionType.CARD_TRANSACTION,
    TransactionType.BANK_TRANSFER,
    TransactionType.MERCURYO_TRANSACTION,
    TransactionType.WRAP,
    TransactionType.UNWRAP,
    TransactionType.MERKL_CLAIM,
    TransactionType.CARD_WELCOME_BONUS,
    TransactionType.DEPOSIT_BONUS,
    TransactionType.FAST_WITHDRAW,
    TransactionType.CANCEL_WITHDRAW,
    TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
    TransactionType.BRIDGE_TRANSFER,
    TransactionType.CARD_WITHDRAWAL,
    TransactionType.REPAY_AND_WITHDRAW_COLLATERAL,
  ];

  it.each(nonDepositTypes)('returns false for %s type', (type) => {
    const activity = makeActivity({
      type,
      status: TransactionStatus.PENDING,
    });
    expect(isDepositWithSteps(activity)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDepositStepIndex
// ---------------------------------------------------------------------------
describe('getDepositStepIndex', () => {
  it('returns 0 for "detected"', () => {
    expect(getDepositStepIndex('detected')).toBe(0);
  });

  it('returns 1 for "confirmed"', () => {
    expect(getDepositStepIndex('confirmed')).toBe(1);
  });

  it('returns 2 for "depositing"', () => {
    expect(getDepositStepIndex('depositing')).toBe(2);
  });

  it('returns 3 for "minting"', () => {
    expect(getDepositStepIndex('minting')).toBe(3);
  });

  it('returns 4 for "complete"', () => {
    expect(getDepositStepIndex('complete')).toBe(4);
  });

  it('returns -1 for undefined', () => {
    expect(getDepositStepIndex(undefined)).toBe(-1);
  });

  it('indices are consistent with DEPOSIT_STEPS ordering', () => {
    DEPOSIT_STEPS.forEach((step, idx) => {
      expect(getDepositStepIndex(step.key)).toBe(idx);
    });
  });
});

// ---------------------------------------------------------------------------
// getDepositStepDescription
// ---------------------------------------------------------------------------
describe('getDepositStepDescription', () => {
  it('returns "Transfer detected" for "detected"', () => {
    expect(getDepositStepDescription('detected')).toBe('Transfer detected');
  });

  it('returns "Transfer confirmed" for "confirmed"', () => {
    expect(getDepositStepDescription('confirmed')).toBe('Transfer confirmed');
  });

  it('returns "Depositing to vault..." for "depositing"', () => {
    expect(getDepositStepDescription('depositing')).toBe('Depositing to vault...');
  });

  it('returns "Minting soUSD..." for "minting"', () => {
    expect(getDepositStepDescription('minting')).toBe('Minting soUSD...');
  });

  it('returns null for "complete" (handled by SUCCESS status display)', () => {
    expect(getDepositStepDescription('complete')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getDepositStepDescription(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DEPOSIT_STEPS constant
// ---------------------------------------------------------------------------
describe('DEPOSIT_STEPS', () => {
  it('contains exactly 5 steps', () => {
    expect(DEPOSIT_STEPS).toHaveLength(5);
  });

  it('has the expected keys in order', () => {
    const keys = DEPOSIT_STEPS.map((s) => s.key);
    expect(keys).toEqual(['detected', 'confirmed', 'depositing', 'minting', 'complete']);
  });

  it('has the expected labels in order', () => {
    const labels = DEPOSIT_STEPS.map((s) => s.label);
    expect(labels).toEqual(['Detected', 'Confirmed', 'Depositing', 'Minting soUSD', 'Complete']);
  });
});
