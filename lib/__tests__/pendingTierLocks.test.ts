import {
  holdPendingTierLock,
  isReceiptTimeout,
  PENDING_TIER_LOCK_TTL_MS,
  reconcilePendingTierLocks,
  releasePendingTierLock,
} from '@/lib/pendingTierLocks';
import { RewardsTier } from '@/lib/types';
import { PendingTierLock, usePendingTierLockStore } from '@/store/usePendingTierLockStore';

jest.mock('@/lib/mmvkStorage', () => {
  const memory = new Map<string, string>();
  return {
    __esModule: true,
    default: () => ({
      setItem: (key: string, value: string) => memory.set(key, value),
      getItem: (key: string) => memory.get(key) ?? null,
      removeItem: (key: string) => memory.delete(key),
    }),
  };
});

const mockGetUserOperationReceipt = jest.fn();
jest.mock('@/lib/pimlico', () => ({
  pimlicoClient: () => ({ getUserOperationReceipt: mockGetUserOperationReceipt }),
}));

const mockConfirmTierLock = jest.fn();
jest.mock('@/lib/api', () => ({
  confirmTierLock: (body: unknown) => mockConfirmTierLock(body),
}));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: <T>(call: () => Promise<T>) => call(),
}));

// The account whose session an API call made now would carry.
const mockSelectedUserId = jest.fn();
jest.mock('@/store/useRewardsUpgradeStore', () => ({
  selectedRewardsUserId: () => mockSelectedUserId(),
}));

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

// The real classifier — `isReceiptTimeout` is only as good as its reading of
// viem's errors — without the support drawer and reporting the index pulls in.
jest.mock('@/lib/errors', () => ({
  toUserError: jest.requireActual('@/lib/errors/classify').toUserError,
}));

const USER = 'user-1';
const HASH = '0x9418d2b5cd787c8accc4fa1d2a0844f0808c0945a1c8885dd33c9e4d8ce1a1f1';
const TX = '0x616c8066046af09a5054d4eb060eb8e30a9c8b30e0892399daa175da3aadaeab';

const lock = (over: Partial<PendingTierLock> = {}): PendingTierLock => ({
  userOpHash: HASH,
  userId: USER,
  submittedAt: Date.now(),
  tier: RewardsTier.PRIME,
  fuseAmount: 50_000,
  asset: 'FUSE',
  ...over,
});

/** viem's error for a hash the bundler has no receipt for. */
const notFound = () =>
  Object.assign(new Error('User Operation receipt with hash could not be found.'), {
    name: 'UserOperationReceiptNotFoundError',
  });

const stored = () => Object.keys(usePendingTierLockStore.getState().locks);

/**
 * Finishing a lock the app sent but never confirmed.
 *
 * The case it was built for: 50,000 FUSE locked through the zap, mined 13s
 * after the press, but the app was backgrounded during the receipt wait and
 * came back 20 minutes later to a timeout — and the confirm was never sent.
 */
describe('reconciling pending tier locks', () => {
  beforeEach(() => {
    usePendingTierLockStore.setState({ locks: {} });
    mockGetUserOperationReceipt.mockReset();
    mockConfirmTierLock.mockReset().mockResolvedValue({});
    mockTrack.mockReset();
    mockSelectedUserId.mockReset().mockReturnValue(USER);
  });

  it('confirms a lock that landed, and forgets it', async () => {
    usePendingTierLockStore.getState().remember(lock());
    mockGetUserOperationReceipt.mockResolvedValue({
      success: true,
      receipt: { transactionHash: TX },
    });

    const results = await reconcilePendingTierLocks(USER);

    expect(mockGetUserOperationReceipt).toHaveBeenCalledWith({ hash: HASH });
    expect(mockConfirmTierLock).toHaveBeenCalledWith({ transactionHash: TX });
    expect(results.map(({ outcome }) => outcome)).toEqual(['confirmed']);
    expect(stored()).toEqual([]);
    expect(mockTrack).toHaveBeenCalledWith(
      'tier_lock_reconciled',
      expect.objectContaining({ outcome: 'confirmed', user_op_hash: HASH }),
    );
  });

  it('forgets a lock that reverted, without confirming it', async () => {
    usePendingTierLockStore.getState().remember(lock());
    mockGetUserOperationReceipt.mockResolvedValue({
      success: false,
      receipt: { transactionHash: TX },
    });

    const results = await reconcilePendingTierLocks(USER);

    expect(mockConfirmTierLock).not.toHaveBeenCalled();
    expect(results.map(({ outcome }) => outcome)).toEqual(['reverted']);
    expect(stored()).toEqual([]);
  });

  it('keeps a lock that has not been mined yet', async () => {
    usePendingTierLockStore.getState().remember(lock());
    mockGetUserOperationReceipt.mockRejectedValue(notFound());

    const results = await reconcilePendingTierLocks(USER);

    expect(results.map(({ outcome }) => outcome)).toEqual(['pending']);
    expect(stored()).toEqual([HASH]);
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it('gives up on a lock the bundler has not seen in the TTL', async () => {
    usePendingTierLockStore
      .getState()
      .remember(lock({ submittedAt: Date.now() - PENDING_TIER_LOCK_TTL_MS - 1 }));
    mockGetUserOperationReceipt.mockRejectedValue(notFound());

    const results = await reconcilePendingTierLocks(USER);

    expect(results.map(({ outcome }) => outcome)).toEqual(['expired']);
    expect(stored()).toEqual([]);
  });

  /** An old lock is only given up on when the bundler says it is unknown. */
  it('keeps even an old lock when the bundler cannot be reached', async () => {
    usePendingTierLockStore
      .getState()
      .remember(lock({ submittedAt: Date.now() - PENDING_TIER_LOCK_TTL_MS - 1 }));
    mockGetUserOperationReceipt.mockRejectedValue(new Error('Network request failed'));

    await reconcilePendingTierLocks(USER);

    expect(stored()).toEqual([HASH]);
  });

  it('keeps a lock that landed when the confirm fails, to try again', async () => {
    usePendingTierLockStore.getState().remember(lock());
    mockGetUserOperationReceipt.mockResolvedValue({
      success: true,
      receipt: { transactionHash: TX },
    });
    mockConfirmTierLock.mockRejectedValue(new Error('502'));

    const results = await reconcilePendingTierLocks(USER);

    expect(results.map(({ outcome }) => outcome)).toEqual(['pending']);
    expect(stored()).toEqual([HASH]);
  });

  /**
   * The confirm carries whichever account is selected when it is sent. A run
   * that outlived a switch to another account must not confirm the lock as
   * that account — the backend would record it there.
   */
  it('leaves the lock for its owner when the account switched mid-run', async () => {
    usePendingTierLockStore.getState().remember(lock());
    mockGetUserOperationReceipt.mockImplementation(async () => {
      // The switch happens while the receipt is being looked up.
      mockSelectedUserId.mockReturnValue('someone-else');
      return { success: true, receipt: { transactionHash: TX } };
    });

    const results = await reconcilePendingTierLocks(USER);

    expect(mockConfirmTierLock).not.toHaveBeenCalled();
    expect(results.map(({ outcome }) => outcome)).toEqual(['pending']);
    expect(stored()).toEqual([HASH]);
  });

  it('leaves alone a lock the flow that sent it is still waiting on', async () => {
    usePendingTierLockStore.getState().remember(lock());
    holdPendingTierLock(HASH);

    try {
      const results = await reconcilePendingTierLocks(USER);
      expect(results).toEqual([]);
      expect(mockGetUserOperationReceipt).not.toHaveBeenCalled();
    } finally {
      releasePendingTierLock(HASH);
    }
  });

  it("only touches the signed-in account's locks", async () => {
    usePendingTierLockStore.getState().remember(lock({ userId: 'someone-else' }));

    const results = await reconcilePendingTierLocks(USER);

    expect(results).toEqual([]);
    expect(mockGetUserOperationReceipt).not.toHaveBeenCalled();
  });
});

describe('isReceiptTimeout', () => {
  it("recognises viem's user operation receipt timeout", () => {
    const error = Object.assign(
      new Error(`Timed out while waiting for User Operation with hash "${HASH}" to be confirmed.`),
      { name: 'WaitForUserOperationReceiptTimeoutError' },
    );

    expect(isReceiptTimeout(error)).toBe(true);
  });

  it('does not mistake a revert for a timeout', () => {
    expect(
      isReceiptTimeout(
        new Error('Execution reverted with reason: UserOperation reverted during simulation'),
      ),
    ).toBe(false);
  });
});
