/// <reference types="jest" />

import {
  decodeRevertReason,
  describeWithdrawError,
  isUserCancelledError,
} from '@/lib/utils/withdrawErrors';

/**
 * The exact message Amplitude recorded for the 21 August withdraw failures,
 * trimmed to the parts that matter. The reason is only present as hex, which is
 * why the user was shown nothing useful.
 */
const AUGUST_REVERT =
  'Execution reverted with reason: UserOperation reverted during simulation with reason: 0x08c379a0' +
  '0000000000000000000000000000000000000000000000000000000000000020' +
  '0000000000000000000000000000000000000000000000000000000000000014' +
  '5452414e534645525f46524f4d5f4641494c4544000000000000000000000000' +
  '.\n\nRequest Arguments:\n  callData: 0x541d63c8';

describe('decodeRevertReason', () => {
  it('decodes the Error(string) payload out of a simulation revert', () => {
    expect(decodeRevertReason(AUGUST_REVERT)).toBe('TRANSFER_FROM_FAILED');
  });

  it('returns undefined when there is no Error(string) payload', () => {
    expect(decodeRevertReason('Execution reverted with reason: 0x.')).toBeUndefined();
    expect(decodeRevertReason('User cancelled transaction')).toBeUndefined();
    expect(decodeRevertReason('')).toBeUndefined();
  });

  it('refuses a payload whose bytes are not readable text', () => {
    const binary =
      '0x08c379a0' +
      '0000000000000000000000000000000000000000000000000000000000000020' +
      '0000000000000000000000000000000000000000000000000000000000000004' +
      '00010203' +
      '0'.repeat(56);
    expect(decodeRevertReason(binary)).toBeUndefined();
  });

  it('refuses a truncated payload rather than decoding garbage', () => {
    const truncated =
      '0x08c379a0' +
      '0000000000000000000000000000000000000000000000000000000000000020' +
      '0000000000000000000000000000000000000000000000000000000000000014' +
      '5452414e'; // reason cut short
    expect(decodeRevertReason(truncated)).toBeUndefined();
  });
});

describe('isUserCancelledError', () => {
  it('recognises a dismissed signing prompt', () => {
    expect(isUserCancelledError(new Error('User cancelled transaction'))).toBe(true);
    expect(isUserCancelledError('User cancelled transaction')).toBe(true);
  });

  it('does not treat a revert as a cancellation', () => {
    expect(isUserCancelledError(new Error(AUGUST_REVERT))).toBe(false);
  });
});

describe('describeWithdrawError', () => {
  it('explains TRANSFER_FROM_FAILED in terms the user can act on', () => {
    const message = describeWithdrawError(new Error(AUGUST_REVERT));

    expect(message).toContain('balance has changed');
    expect(message).not.toContain('0x');
    expect(message).not.toContain('TRANSFER_FROM_FAILED');
  });

  it('names an unrecognised revert reason instead of hiding it', () => {
    const reverted =
      'reverted: 0x08c379a0' +
      '0000000000000000000000000000000000000000000000000000000000000020' +
      '000000000000000000000000000000000000000000000000000000000000000f' +
      '446561646c696e65206578706972790000000000000000000000000000000000'; // "Deadline expiry"

    expect(describeWithdrawError(new Error(reverted))).toBe('Withdrawal failed: Deadline expiry.');
  });

  it('reports a cancellation as a cancellation, not a failure', () => {
    expect(describeWithdrawError(new Error('User cancelled transaction'))).toBe(
      'Withdrawal cancelled.',
    );
  });

  it('falls back to a plain sentence for anything unrecognised', () => {
    expect(describeWithdrawError(new Error('socket hang up'))).toBe(
      'Something went wrong with your withdrawal. Please try again.',
    );
    expect(describeWithdrawError(undefined)).toBe(
      'Something went wrong with your withdrawal. Please try again.',
    );
  });
});
