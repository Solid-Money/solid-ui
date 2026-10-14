import { decodeFunctionData, erc20Abi, parseUnits } from 'viem';

import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { ADDRESSES } from '@/lib/config';
import {
  buildSoEurcDepositCalls,
  getSoEurcMinimumMint,
  SOEURC_DEPOSIT_ASSET,
} from '@/lib/deposit/soEurc';

// The real client builds viem transports; only the pure helpers are under test.
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

const EURC_ON_BASE = '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42';

describe('soEURC deposit', () => {
  it('deposits EURC on Base', () => {
    expect(SOEURC_DEPOSIT_ASSET.toLowerCase()).toBe(EURC_ON_BASE.toLowerCase());
  });

  it('quotes shares at the teller rate, less 0.5%', () => {
    const amount = parseUnits('100', 6);
    // At par (1e6), 100 EURC mints 100 soEURC; the floor is 99.5.
    expect(getSoEurcMinimumMint(amount, 1_000_000n)).toBe(parseUnits('99.5', 6));
    // A share worth 1.25 EURC mints 80 shares; the floor is 79.6.
    expect(getSoEurcMinimumMint(amount, 1_250_000n)).toBe(parseUnits('79.6', 6));
  });

  it('never quotes a minimum for a zero amount or an unreadable rate', () => {
    expect(getSoEurcMinimumMint(0n, 1_000_000n)).toBe(0n);
    expect(getSoEurcMinimumMint(parseUnits('1', 6), 0n)).toBe(0n);
  });

  // In a BoringVault the vault pulls the asset in enter(), so the VAULT is the
  // spender, and the teller is what gets called.
  it('approves the vault for exactly the amount, then deposits through the teller', () => {
    const amount = parseUnits('250', 6);
    const minimumMint = getSoEurcMinimumMint(amount, 1_000_000n);
    const [approve, deposit] = buildSoEurcDepositCalls(amount, minimumMint);

    expect(approve.to).toBe(SOEURC_DEPOSIT_ASSET);
    const approval = decodeFunctionData({ abi: erc20Abi, data: approve.data });
    expect(approval.functionName).toBe('approve');
    expect(approval.args).toEqual([ADDRESSES.base.soEurcVault, amount]);

    expect(deposit.to).toBe(ADDRESSES.base.soEurcTeller);
    expect(deposit.value).toBe(0n);
    const call = decodeFunctionData({ abi: ETHEREUM_TELLER_ABI, data: deposit.data });
    expect(call.functionName).toBe('deposit');
    expect(call.args).toEqual([SOEURC_DEPOSIT_ASSET, amount, minimumMint]);
  });
});
