/// <reference types="jest" />

import { UserCopyError } from '@/lib/errors/UserCopyError';
import { resumeWithdrawAmount, withdrawShortfallCopy } from '@/lib/soUsdWithdraw';
import { assertSponsoredMinimum, sponsoredMinimumCopy } from '@/lib/sponsoredMinimum';
import { publicClient } from '@/lib/wagmi';

jest.mock('@/lib/wagmi', () => ({ publicClient: jest.fn() }));

const TELLER = '0x220d4667AA06E0Aa39f62c601690848f2e48BC15';
const readContract = jest.fn();

beforeEach(() => {
  readContract.mockReset();
  (publicClient as jest.Mock).mockReturnValue({ readContract });
});

describe('sponsored minimum', () => {
  it('reads as plain copy', () => {
    expect(sponsoredMinimumCopy('withdrawal', 100000n, 'soUSD')).toBe(
      'Minimum withdrawal is 0.1 soUSD',
    );
    expect(sponsoredMinimumCopy('deposit', 5000000n, 'USDC')).toBe('Minimum deposit is 5 USDC');
  });

  it('stops an amount below the paymaster minimum before anything is signed', async () => {
    readContract.mockResolvedValue(100000n); // 0.1 soUSD, as on Fuse in Nov 2026
    // The dust withdrawals that failed every time over the weekend.
    await expect(
      assertSponsoredMinimum(TELLER, 38317n, { what: 'withdrawal', symbol: 'soUSD' }),
    ).rejects.toEqual(new UserCopyError('Minimum withdrawal is 0.1 soUSD'));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'minSponsoredAmount', args: [TELLER] }),
    );
  });

  it('lets the minimum itself and more through', async () => {
    readContract.mockResolvedValue(100000n);
    await expect(
      assertSponsoredMinimum(TELLER, 100000n, { what: 'withdrawal', symbol: 'soUSD' }),
    ).resolves.toBeUndefined();
  });

  it('does not block when the minimum cannot be read', async () => {
    readContract.mockRejectedValue(new Error('RPC down'));
    await expect(
      assertSponsoredMinimum(TELLER, 1n, { what: 'withdrawal', symbol: 'soUSD' }),
    ).resolves.toBeUndefined();
  });
});

describe('resuming a soUSD withdraw on the withdraw chain', () => {
  it('offers the shares that arrived when the bridge fee left fewer than were sent', () => {
    // carlamadail, Nov 14: 20.841956 sent from Fuse, 20.554818 arrived on Base.
    expect(resumeWithdrawAmount('20.841956', 20554818n)).toBe('20.554818');
  });

  it('keeps the sent amount when as much arrived, or before the balance loads', () => {
    expect(resumeWithdrawAmount('5', 5000000n)).toBe('5');
    expect(resumeWithdrawAmount('5', 7000000n)).toBe('5');
    expect(resumeWithdrawAmount('5', undefined)).toBe('5');
    expect(resumeWithdrawAmount('5', 0n)).toBe('5');
  });

  it('explains a request for more shares than are there instead of reverting', () => {
    expect(withdrawShortfallCopy(20841956n, 20554818n, 'Base')).toBe(
      'Only 20.554818 soUSD is on Base. Withdraw up to that amount.',
    );
    expect(withdrawShortfallCopy(2755340n, 0n, 'Base')).toBe(
      'There is no soUSD on Base to withdraw yet.',
    );
    expect(withdrawShortfallCopy(20554818n, 20554818n, 'Base')).toBeUndefined();
  });
});
