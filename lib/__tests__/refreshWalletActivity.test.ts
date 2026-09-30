import { fetchActivityEvent, fetchActivityEvents } from '@/lib/api';
import { refreshWalletActivity } from '@/lib/refreshWalletActivity';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';
import { useActivityStore } from '@/store/useActivityStore';

jest.mock('@/lib/config', () => ({ USER: 'user' }));
jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({ getItem: () => null, setItem: jest.fn() }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));
jest.mock('@/lib/api', () => ({ fetchActivityEvents: jest.fn(), fetchActivityEvent: jest.fn() }));

const row = (id: string, status = TransactionStatus.PENDING): ActivityEvent => ({
  clientTxId: id,
  type: TransactionType.DEPOSIT,
  status,
  title: 'Deposit',
  amount: '1',
  symbol: 'USDC',
  timestamp: '123',
});

describe('wallet activity reconciliation without live events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useActivityStore.setState({ events: {} });
  });
  it('adds new rows, updates recent rows and completes older processing rows outside page one', async () => {
    useActivityStore.setState({
      events: {
        account: [
          row('recent'),
          row('older', TransactionStatus.PROCESSING),
          row('complete', TransactionStatus.SUCCESS),
        ],
      },
    });
    (fetchActivityEvents as jest.Mock).mockResolvedValue({
      docs: [row('new', TransactionStatus.SUCCESS), row('recent', TransactionStatus.SUCCESS)],
      hasNextPage: true,
    });
    (fetchActivityEvent as jest.Mock).mockResolvedValue(row('older', TransactionStatus.SUCCESS));
    await refreshWalletActivity('account', '0xABC');
    const rows = useActivityStore.getState().events.account;
    expect(rows).toHaveLength(4);
    expect(rows.every(event => event.status === TransactionStatus.SUCCESS)).toBe(true);
    expect(fetchActivityEvent).toHaveBeenCalledTimes(1);
    expect(fetchActivityEvent).toHaveBeenCalledWith('older');
  });
  it('preserves optimistic rows that the server has not indexed yet', async () => {
    useActivityStore.setState({ events: { account: [row('optimistic')] } });
    (fetchActivityEvents as jest.Mock).mockResolvedValue({ docs: [], hasNextPage: false });
    (fetchActivityEvent as jest.Mock).mockRejectedValue({ status: 404 });
    await expect(refreshWalletActivity('account', '0xABC')).resolves.toMatchObject({ docs: [] });
    expect(useActivityStore.getState().events.account).toHaveLength(1);
  });
  it('surfaces failures while retaining successful row updates', async () => {
    useActivityStore.setState({ events: { account: [row('old')] } });
    (fetchActivityEvents as jest.Mock).mockResolvedValue({
      docs: [row('new')],
      hasNextPage: false,
    });
    (fetchActivityEvent as jest.Mock).mockRejectedValue(new Error('Network failed'));
    await expect(refreshWalletActivity('account', '0xABC')).rejects.toThrow('Network failed');
    expect(
      useActivityStore.getState().events.account.some(event => event.clientTxId === 'new'),
    ).toBe(true);
  });
});
