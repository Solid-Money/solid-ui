import { decodeFunctionData, erc20Abi, keccak256, zeroAddress } from 'viem';

import { WRAPPED_FUSE } from '@/constants/addresses';
import BridgePaymasterABI from '@/lib/abis/BridgePayamster';
import { wNativeABI } from '@/lib/abis/tokens';
import { buildSponsoredLifiCalls, SponsoredLifiQuote } from '@/lib/utils/swap/sponsoredLifiCalls';

const PAYMASTER = '0x8D5333d3d9683D4D67F329027F0f5d4057f3306b';
const DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
const SAFE = '0x00000000000000000000000000000000000000AA';
const USDC_FUSE = '0xc6Bc407706B7140EE8Eef2f86F9504651b63e7f9';
const LIFI_DATA = '0xa6010a66deadbeef';
const SIGNATURE = `0x${'11'.repeat(65)}` as const;

const quote = (
  token: string,
  amount: string,
  overrides: { wrapNative?: boolean; paymaster?: `0x${string}` } = {},
): SponsoredLifiQuote => ({
  transactionRequest: { to: DIAMOND, data: LIFI_DATA, value: '1000', chainId: 122 },
  sponsorship: {
    paymaster: overrides.paymaster ?? PAYMASTER,
    wrapNative: overrides.wrapNative ?? false,
    voucher: {
      from: SAFE,
      target: DIAMOND,
      token,
      amount,
      dataHash: keccak256(LIFI_DATA),
      nativeFee: '420000000000000',
      // Past 2^53, so a Number on the way would lose it.
      nonce: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      deadline: '1793450000',
    },
    signature: SIGNATURE,
  },
});

const decodeApprove = (data: `0x${string}`) => decodeFunctionData({ abi: erc20Abi, data });
const decodeLifiCall = (data: `0x${string}`) =>
  decodeFunctionData({ abi: BridgePaymasterABI, data });

describe('sponsored LI.FI calls', () => {
  it('approves the paymaster for an ERC-20 and calls it with the voucher, LI.FI’s data and the signature', () => {
    const calls = buildSponsoredLifiCalls(quote(USDC_FUSE, '5000000'), 0n);
    expect(calls.map(call => [call.to, call.value])).toEqual([
      [USDC_FUSE, 0n],
      [PAYMASTER, 0n],
    ]);
    expect(decodeApprove(calls[0].data)).toEqual({
      functionName: 'approve',
      args: [PAYMASTER, 5_000_000n],
    });
    expect(decodeLifiCall(calls[1].data)).toEqual({
      functionName: 'lifiCall',
      args: [
        {
          from: SAFE,
          target: DIAMOND,
          token: USDC_FUSE,
          amount: 5_000_000n,
          dataHash: keccak256(LIFI_DATA),
          nativeFee: 420_000_000_000_000n,
          nonce: 2n ** 256n - 1n,
          deadline: 1_793_450_000n,
        },
        LIFI_DATA,
        SIGNATURE,
      ],
    });
  });

  it('resets an allowance the Safe already gave the paymaster before approving', () => {
    const calls = buildSponsoredLifiCalls(quote(USDC_FUSE, '5000000'), 7n);
    expect(calls.map(call => call.to)).toEqual([USDC_FUSE, USDC_FUSE, PAYMASTER]);
    expect(decodeApprove(calls[0].data).args).toEqual([PAYMASTER, 0n]);
    expect(decodeApprove(calls[1].data).args).toEqual([PAYMASTER, 5_000_000n]);
  });

  it('sends ETH along with the call and approves nothing when paying in the native coin', () => {
    const calls = buildSponsoredLifiCalls(quote(zeroAddress, '2000000000000000'), 0n);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ to: PAYMASTER, value: 2_000_000_000_000_000n });
    expect(decodeLifiCall(calls[0].data).args?.[0]).toMatchObject({
      token: zeroAddress,
      amount: 2_000_000_000_000_000n,
    });
  });

  it('wraps FUSE into WFUSE first, then spends the WFUSE', () => {
    const amount = 300n * 10n ** 18n;
    const calls = buildSponsoredLifiCalls(
      quote(WRAPPED_FUSE.toLowerCase(), amount.toString(), { wrapNative: true }),
      0n,
    );
    expect(calls.map(call => [call.to, call.value])).toEqual([
      [WRAPPED_FUSE, amount],
      [WRAPPED_FUSE.toLowerCase(), 0n],
      [PAYMASTER, 0n],
    ]);
    expect(decodeFunctionData({ abi: wNativeABI, data: calls[0].data }).functionName).toBe(
      'deposit',
    );
    expect(decodeApprove(calls[1].data).args).toEqual([PAYMASTER, amount]);
  });

  it('refuses to wrap FUSE for a voucher that spends something else', () => {
    expect(() =>
      buildSponsoredLifiCalls(quote(USDC_FUSE, '5000000', { wrapNative: true }), 0n),
    ).toThrow('WFUSE');
  });
});
