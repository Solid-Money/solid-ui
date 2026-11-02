import { base } from 'viem/chains';

import { STOCK_VAULTS } from '@/constants/stockVaults';
import { getCancelWithdrawTarget } from '@/hooks/useCancelOnchainWithdraw';
import { ADDRESSES } from '@/lib/config';

// Only the target lookup is under test, not the hook that sends the cancel.
jest.mock('@/hooks/useActivityActions', () => ({ useActivityActions: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@/hooks/useBaseWithdrawRequests', () => ({ BASE_WITHDRAW_REQUEST: 'request' }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/execute', () => ({ executeTransactions: jest.fn() }));

describe('getCancelWithdrawTarget', () => {
  // Each stock queue makes cancelOnChainWithdrawUsingRequestId public (read 2026-11-01).
  it("cancels a stock vault request on that vault's own queue, on Base", () => {
    for (const stock of STOCK_VAULTS) {
      expect(getCancelWithdrawTarget(stock.shareSymbol, base.id)).toEqual({
        chain: base,
        queue: stock.boringQueue,
        shareSymbol: stock.shareSymbol,
        shareAddress: stock.vault,
      });
    }
  });

  it('still sends a soEURC cancel to the soEURC queue', () => {
    expect(getCancelWithdrawTarget('soEURC', base.id)?.queue).toBe(
      ADDRESSES.base.soEurcBoringQueue,
    );
  });
});
