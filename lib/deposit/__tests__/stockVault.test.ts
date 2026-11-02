import { decodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getStockVault, STOCK_VAULTS } from '@/constants/stockVaults';
import ETHEREUM_TELLER_ABI from '@/lib/abis/EthereumTeller';
import { buildStockVaultDepositCalls, getStockVaultMinimumMint } from '@/lib/deposit/stockVault';
import { VaultType } from '@/lib/types';

// The real client builds viem transports; only the pure helpers are under test.
jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

const aapl = getStockVault(VaultType.AAPL)!;

describe('stock vault deposit', () => {
  it('quotes shares at the teller rate, less 0.5%', () => {
    const amount = parseUnits('2', 8);
    // At one for one (1e8), 2 AAPLc mints 2 soAAPL; the floor is 1.99.
    expect(getStockVaultMinimumMint(aapl, amount, 100_000_000n)).toBe(parseUnits('1.99', 8));
    // A share worth 1.25 AAPLc mints 1.6 shares; the floor is 1.592.
    expect(getStockVaultMinimumMint(aapl, amount, 125_000_000n)).toBe(parseUnits('1.592', 8));
  });

  it('never quotes a minimum for a zero amount or an unreadable rate', () => {
    expect(getStockVaultMinimumMint(aapl, 0n, 100_000_000n)).toBe(0n);
    expect(getStockVaultMinimumMint(aapl, parseUnits('1', 8), 0n)).toBe(0n);
  });

  // In a BoringVault the vault pulls the asset in enter(), so the VAULT is the
  // spender, and the teller is what gets called — for every stock, its own.
  it('approves the vault for exactly the amount, then deposits through its teller', () => {
    for (const stock of STOCK_VAULTS) {
      const amount = parseUnits('0.5', 8);
      const minimumMint = getStockVaultMinimumMint(stock, amount, 100_000_000n);
      const [approve, deposit] = buildStockVaultDepositCalls(stock, amount, minimumMint);

      expect(approve.to).toBe(stock.stockToken.address);
      expect(approve.value).toBe(0n);
      const approval = decodeFunctionData({ abi: erc20Abi, data: approve.data });
      expect(approval.functionName).toBe('approve');
      expect(approval.args).toEqual([stock.vault, amount]);

      expect(deposit.to).toBe(stock.teller);
      expect(deposit.value).toBe(0n);
      const call = decodeFunctionData({ abi: ETHEREUM_TELLER_ABI, data: deposit.data });
      expect(call.functionName).toBe('deposit');
      expect(call.args).toEqual([stock.stockToken.address, amount, minimumMint]);
    }
  });
});
