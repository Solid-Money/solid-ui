/// <reference types="jest" />

import { BaseError, RpcRequestError } from 'viem';
import { getUserOperationError } from 'viem/account-abstraction';

import { classifyError, normalizeError, toUserError } from '@/lib/errors/classify';
import { sanitizeTechnicalMessage } from '@/lib/errors/sanitize';

/** A sponsored operation, as viem prints it in every bundler error it wraps. */
const SPONSORED_OPERATION = {
  sender: '0x6f8C1E34acbB288e1a9e2FD859B93a5379A645e2',
  nonce: 8n,
  callData: '0x',
  callGasLimit: 1n,
  verificationGasLimit: 1n,
  preVerificationGas: 1n,
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
  paymaster: '0x777777777777AeC03fd955926DbF81597e66834C',
  paymasterData: '0x',
  signature: '0x',
} as const;

const REASON =
  'UserOperation reverted during simulation with reason: Sender does not implement validateUserOp or factory is not deployed';

/** What Pimlico answers when an operation reverts in `simulateValidation` (code -32500). */
const bundlerError = (message: string, code = -32500) =>
  getUserOperationError(
    new RpcRequestError({
      body: { method: 'eth_estimateUserOperationGas', params: [] },
      error: { code, message },
      url: 'https://api.pimlico.io/v2/122/rpc?apikey=pim_REDACTEDREDACTED',
    }),
    SPONSORED_OPERATION as any,
  );

/**
 * The same error when the inner one comes from another viem copy, so
 * `instanceof BaseError` fails across them: the outer Details line becomes
 * "RPC Request failed." and the reason moves to a second Details line.
 */
const crossCopyBundlerError = (message: string) => {
  const inner = new RpcRequestError({
    body: { method: 'eth_estimateUserOperationGas', params: [] },
    error: { code: -32500, message },
    url: 'https://api.pimlico.io/v2/122/rpc?apikey=pim_REDACTEDREDACTED',
  });
  // Another copy's BaseError: same methods, different class.
  Object.setPrototypeOf(
    inner,
    Object.create(Error.prototype, { walk: { value: BaseError.prototype.walk } }),
  );
  return getUserOperationError(inner as any, SPONSORED_OPERATION as any);
};

describe('bundler errors on sponsored operations', () => {
  it('names the paymaster in its text, as every sponsored operation does', () => {
    expect(bundlerError(REASON).message).toMatch(/paymaster/i);
  });

  it('files a simulation revert as SIMULATION_REVERTED, not PAYMASTER_REJECTED', () => {
    expect(classifyError(normalizeError(bundlerError(REASON))).code).toBe('SIMULATION_REVERTED');
    // Same copy for the user either way: nothing was sent.
    expect(toUserError(bundlerError(REASON), { action: 'swap' })).toMatchObject({
      kind: 'blockchain',
      nothingSent: true,
    });
  });

  it('still files the gas sponsor saying no as PAYMASTER_REJECTED', () => {
    for (const error of [
      bundlerError(
        'Insufficient Pimlico balance for sponsorship, please top up - Balance required: 0.003767 USD, Balance available: -1000.73336 USD',
        -32603,
      ),
      bundlerError('Paymaster validation failed', -32501),
      bundlerError('AA31 paymaster deposit too low', -32500),
      bundlerError('AA33 reverted', -32500),
    ]) {
      expect(classifyError(normalizeError(error)).code).toBe('PAYMASTER_REJECTED');
    }
  });

  it('keeps other AA codes specific', () => {
    expect(classifyError(normalizeError(bundlerError('AA25 invalid account nonce'))).code).toBe(
      'USEROP_AA25',
    );
  });

  it('keeps the bundler reason in the technical message', () => {
    const technical = sanitizeTechnicalMessage(normalizeError(bundlerError(REASON)).message);
    expect(technical).toContain(`Details: ${REASON}`);
    expect(technical).not.toContain('pim_');
  });

  it('keeps the bundler reason when the inner error comes from another viem copy', () => {
    const error = crossCopyBundlerError(REASON);
    // The shape mobile reports had: the first Details line is viem's short message.
    expect(error.message).toMatch(/^Details: RPC Request failed\.$/m);

    const technical = sanitizeTechnicalMessage(normalizeError(error).message);
    expect(technical).toContain(`Details: ${REASON}`);
    expect(technical).not.toContain('Details: RPC Request failed.');
    expect(technical).not.toContain('pim_');
  });
});
