import { encodeFunctionData, erc20Abi, zeroAddress } from 'viem';

import { verifiedSafeRecoveryHash } from '@/lib/utils/safeRecovery';

import type { SafeRecoveryPrepared } from '@/lib/types';

const SAFE = '0xd89fE839283411D033798826FB47960DA5DBcDCf';
const USDT0 = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb';
const DESTINATION = '0x08A7a685Cb536Fff6F21f067a50500Fa9Df0b3d4';
// Safe 1.4.1 `getTransactionHash` for this transfer at nonce 0 on Plasma, read on chain.
const ONCHAIN_HASH = '0x6c96097255bea20557537e915876a8756465145ad40c0470843f196a474a41dd';

const transfer = (to: string, amount: bigint) =>
  encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to as `0x${string}`, amount],
  });

const prepared = (overrides: Partial<SafeRecoveryPrepared> = {}): SafeRecoveryPrepared => ({
  id: 'r1',
  chainId: 9745,
  network: 'Plasma',
  safeAddress: SAFE,
  tokenAddress: USDT0,
  symbol: 'USDT0',
  decimals: 6,
  amount: '10000000',
  amountFormatted: '10',
  destinationAddress: DESTINATION,
  receiveSymbol: 'USDC',
  receiveNetwork: 'Base',
  safeTx: {
    to: USDT0,
    value: '0',
    data: transfer(DESTINATION, 10_000000n),
    operation: 0,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: zeroAddress,
    refundReceiver: zeroAddress,
    nonce: '0',
  },
  safeTxHash: ONCHAIN_HASH,
  expiresAt: new Date().toISOString(),
  ...overrides,
});

describe('verifiedSafeRecoveryHash', () => {
  it("returns the Safe's own hash for a plain transfer from the user's Safe", () => {
    expect(verifiedSafeRecoveryHash(prepared(), SAFE.toLowerCase())).toBe(ONCHAIN_HASH);
  });

  it("refuses a transaction from someone else's Safe", () => {
    expect(() =>
      verifiedSafeRecoveryHash(prepared(), '0x1111111111111111111111111111111111111111'),
    ).toThrow('not from your Solid wallet');
  });

  it('refuses a transfer to an address other than the one shown', () => {
    const base = prepared();
    const tampered = prepared({
      safeTx: {
        ...base.safeTx,
        data: transfer('0x2222222222222222222222222222222222222222', 10_000000n),
      },
    });
    expect(() => verifiedSafeRecoveryHash(tampered, SAFE)).toThrow('does not match');
  });

  it('refuses an amount other than the one shown', () => {
    expect(() => verifiedSafeRecoveryHash(prepared({ amount: '1' }), SAFE)).toThrow(
      'does not match',
    );
  });

  it('refuses a delegate call or a gas refund', () => {
    const base = prepared();
    expect(() =>
      verifiedSafeRecoveryHash(prepared({ safeTx: { ...base.safeTx, operation: 1 } }), SAFE),
    ).toThrow('unexpected terms');
    expect(() =>
      verifiedSafeRecoveryHash(prepared({ safeTx: { ...base.safeTx, gasPrice: '1' } }), SAFE),
    ).toThrow('unexpected terms');
  });

  it('refuses a call to a contract other than the token', () => {
    const base = prepared();
    expect(() =>
      verifiedSafeRecoveryHash(
        prepared({ safeTx: { ...base.safeTx, to: '0x3333333333333333333333333333333333333333' } }),
        SAFE,
      ),
    ).toThrow('does not move the token shown');
  });

  it('refuses a hash the server got wrong, or for another transaction', () => {
    expect(() =>
      verifiedSafeRecoveryHash(prepared({ safeTxHash: `0x${'00'.repeat(32)}` }), SAFE),
    ).toThrow('could not be verified');
  });
});
