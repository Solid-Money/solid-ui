import { encodeFunctionData, erc20Abi, zeroAddress } from 'viem';

import {
  ApprovedSafeRecovery,
  parseSafeRecovery,
  parseSafeRecoveryBalances,
  SafeRecoveryAmountChangedError,
  verifiedSafeRecoveryHash,
} from '@/lib/utils/safeRecovery';

import type { SafeRecoveryPrepared } from '@/lib/types';

const SAFE = '0xd89fE839283411D033798826FB47960DA5DBcDCf';
const USDT0 = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb';
const DESTINATION = '0x08A7a685Cb536Fff6F21f067a50500Fa9Df0b3d4';
// Safe 1.4.1 `getTransactionHash` for this transfer at nonce 0 on Plasma, read on chain.
const ONCHAIN_HASH = '0x6c96097255bea20557537e915876a8756465145ad40c0470843f196a474a41dd';

/** The card the user tapped. */
const APPROVED: ApprovedSafeRecovery = {
  chainId: 9745,
  tokenAddress: USDT0.toLowerCase(),
  amount: '10000000',
};

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

const verify = (p: SafeRecoveryPrepared, safe = SAFE, approved = APPROVED) =>
  verifiedSafeRecoveryHash(p, safe, approved);

describe('verifiedSafeRecoveryHash', () => {
  it("returns the Safe's own hash for a plain transfer from the user's Safe", () => {
    expect(verify(prepared(), SAFE.toLowerCase())).toBe(ONCHAIN_HASH);
  });

  it("refuses a transaction from someone else's Safe", () => {
    expect(() => verify(prepared(), '0x1111111111111111111111111111111111111111')).toThrow(
      'not from your Solid wallet',
    );
  });

  it('refuses a transfer on another network or of another token than the card tapped', () => {
    expect(() => verify(prepared(), SAFE, { ...APPROVED, chainId: 10 })).toThrow(
      'not for the token shown',
    );
    expect(() =>
      verify(prepared(), SAFE, {
        ...APPROVED,
        tokenAddress: '0x2d661c89d812261039af9764eceaaee884f5f67f',
      }),
    ).toThrow('not for the token shown');
  });

  it('stops for approval when the amount is no longer the one on the card', () => {
    const changed = prepared({
      amount: '20000000',
      safeTx: { ...prepared().safeTx, data: transfer(DESTINATION, 20_000000n) },
    });

    let error: unknown;
    try {
      verify(changed);
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(SafeRecoveryAmountChangedError);
    expect((error as SafeRecoveryAmountChangedError).amount).toBe('20000000');
  });

  it('refuses a transfer to an address other than the one shown', () => {
    const base = prepared();
    const tampered = prepared({
      safeTx: {
        ...base.safeTx,
        data: transfer('0x2222222222222222222222222222222222222222', 10_000000n),
      },
    });
    expect(() => verify(tampered)).toThrow('does not match');
  });

  it('refuses calldata moving an amount other than the one shown', () => {
    const base = prepared();
    const tampered = prepared({
      safeTx: { ...base.safeTx, data: transfer(DESTINATION, 99_000000n) },
    });
    expect(() => verify(tampered)).toThrow('does not match');
  });

  it('refuses a delegate call or a gas refund', () => {
    const base = prepared();
    expect(() => verify(prepared({ safeTx: { ...base.safeTx, operation: 1 } }))).toThrow(
      'unexpected terms',
    );
    expect(() => verify(prepared({ safeTx: { ...base.safeTx, gasPrice: '1' } }))).toThrow(
      'unexpected terms',
    );
  });

  it('refuses a call to a contract other than the token', () => {
    const base = prepared();
    expect(() =>
      verify(
        prepared({ safeTx: { ...base.safeTx, to: '0x3333333333333333333333333333333333333333' } }),
      ),
    ).toThrow('does not move the token shown');
  });

  it('refuses a hash the server got wrong, or for another transaction', () => {
    expect(() => verify(prepared({ safeTxHash: `0x${'00'.repeat(32)}` }))).toThrow(
      'could not be verified',
    );
  });
});

const BALANCE = {
  chainId: 9745,
  network: 'Plasma',
  safeAddress: SAFE,
  tokenAddress: USDT0,
  symbol: 'USDT0',
  decimals: 6,
  amount: '10000000',
  amountFormatted: '10',
};

const RECOVERY = {
  id: 'r1',
  chainId: 9745,
  network: 'Plasma',
  tokenAddress: USDT0,
  symbol: 'USDT0',
  decimals: 6,
  amount: '10000000',
  amountFormatted: '10',
  destinationAddress: DESTINATION,
  status: 'submitted',
  createdAt: '2026-11-26T00:00:00.000Z',
  updatedAt: '2026-11-26T00:00:00.000Z',
};

describe('parseSafeRecoveryBalances', () => {
  it('passes a well-formed response through, recovery included', () => {
    const response = { enabled: true, items: [BALANCE, { ...BALANCE, recovery: RECOVERY }] };

    expect(parseSafeRecoveryBalances(response)).toEqual(response);
  });

  it.each([
    ['a missing token address', { ...BALANCE, tokenAddress: undefined }],
    ['a null token address', { ...BALANCE, tokenAddress: null }],
    ['an amount that is not base units', { ...BALANCE, amount: '10.5' }],
    ['a chain id that is not a number', { ...BALANCE, chainId: '9745' }],
    ['an unreadable formatted amount', { ...BALANCE, amountFormatted: 'ten' }],
    ['a recovery with an unknown status', { ...BALANCE, recovery: { ...RECOVERY, status: 'odd' } }],
  ])('refuses %s', (_label, item) => {
    expect(() => parseSafeRecoveryBalances({ enabled: true, items: [item] })).toThrow(
      'from the server',
    );
  });

  it('refuses a malformed envelope', () => {
    expect(() => parseSafeRecoveryBalances(null)).toThrow('from the server');
    expect(() => parseSafeRecoveryBalances({ enabled: true })).toThrow('from the server');
  });
});

describe('parseSafeRecovery', () => {
  it('passes a well-formed recovery through', () => {
    expect(parseSafeRecovery(RECOVERY)).toEqual(RECOVERY);
  });

  it('refuses one without an id or status', () => {
    expect(() => parseSafeRecovery({ ...RECOVERY, id: '' })).toThrow('from the server');
    expect(() => parseSafeRecovery({ ...RECOVERY, status: undefined })).toThrow('from the server');
  });
});
