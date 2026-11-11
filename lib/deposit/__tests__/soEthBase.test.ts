import { decodeFunctionData, erc20Abi, parseUnits } from 'viem';

import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import { buildSoEthBaseDepositCalls, getSoEthMinimumMint } from '@/lib/deposit/soEthBase';

// The real client builds viem transports; only the pure helpers are under test.
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

describe('soETH deposit on Base', () => {
  it('quotes shares at the teller rate, less 0.5%', () => {
    const amount = parseUnits('1', 18);
    // At par, 1 WETH mints 1 soETH; the floor is 0.995.
    expect(getSoEthMinimumMint(amount, parseUnits('1', 18))).toBe(parseUnits('0.995', 18));
    // A share worth 1.25 WETH mints 0.8 shares; the floor is 0.796.
    expect(getSoEthMinimumMint(amount, parseUnits('1.25', 18))).toBe(parseUnits('0.796', 18));
  });

  it('never quotes a minimum for a zero amount or an unreadable rate', () => {
    expect(getSoEthMinimumMint(0n, parseUnits('1', 18))).toBe(0n);
    expect(getSoEthMinimumMint(parseUnits('1', 18), 0n)).toBe(0n);
  });

  it('approves the vault for exactly the WETH, then deposits it through the teller', () => {
    const amount = parseUnits('0.5', 18);
    const [approve, deposit] = buildSoEthBaseDepositCalls(amount, 1n, false);

    expect(approve.to).toBe(ADDRESSES.base.weth);
    expect(decodeFunctionData({ abi: erc20Abi, data: approve.data }).args).toEqual([
      ADDRESSES.base.soEthVault,
      amount,
    ]);
    expect(deposit.to).toBe(ADDRESSES.base.soEthTeller);
    expect(decodeFunctionData({ abi: ETHEREUM_TELLER_ABI, data: deposit.data })).toMatchObject({
      functionName: 'deposit',
      args: [ADDRESSES.base.weth, amount, 1n],
    });
  });

  it('wraps native ETH first, sending the amount as value to WETH', () => {
    const amount = parseUnits('0.5', 18);
    const calls = buildSoEthBaseDepositCalls(amount, 1n, true);

    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({ to: ADDRESSES.base.weth, value: amount });
    expect(calls.slice(1).every(call => call.value === 0n)).toBe(true);
  });
});
