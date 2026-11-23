import { fetchAlchemyTokenBalances } from '@/lib/alchemy';
import { fetchTokenBalancesWithFallback } from '@/lib/data-source';

jest.mock('axios', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('@/lib/alchemy', () => ({
  fetchAlchemyTokenBalances: jest.fn(),
  fetchAlchemyTokenTransfers: jest.fn(),
}));
const mockAlchemy = jest.mocked(fetchAlchemyTokenBalances);
const originalFetch = global.fetch;
const mockFetch = jest.fn();
let warn: jest.SpyInstance;
beforeEach(() => {
  global.fetch = mockFetch;
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  warn.mockRestore();
  jest.resetAllMocks();
});

it('uses the healthy primary source without a second balance read', async () => {
  mockAlchemy.mockResolvedValue([]);
  await expect(fetchTokenBalancesWithFallback(1, '0xabc')).resolves.toEqual([]);
  expect(mockFetch).not.toHaveBeenCalled();
});
it('uses Blockscout when the primary source fails', async () => {
  mockAlchemy.mockRejectedValue(new Error('primary unavailable'));
  mockFetch.mockResolvedValue({ ok: true, json: async () => [{ value: '100' }] });
  await expect(fetchTokenBalancesWithFallback(1, '0xabc')).resolves.toEqual([{ value: '100' }]);
});
it('propagates an unsupported BSC fallback instead of reporting an empty wallet', async () => {
  mockAlchemy.mockRejectedValue(new Error('primary unavailable'));
  await expect(fetchTokenBalancesWithFallback(56, '0xabc')).rejects.toThrow('No balance fallback');
});
it('propagates a failed backup source instead of reporting an empty wallet', async () => {
  mockAlchemy.mockRejectedValue(new Error('primary unavailable'));
  mockFetch.mockResolvedValue({ ok: false, status: 503 });
  await expect(fetchTokenBalancesWithFallback(1, '0xabc')).rejects.toThrow('503');
});
it('gives up on a Blockscout fallback that hangs, instead of holding the balances', async () => {
  jest.useFakeTimers();
  try {
    mockAlchemy.mockRejectedValue(new Error('primary unavailable'));
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const read = fetchTokenBalancesWithFallback(1, '0xabc');
    const settled = expect(read).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(10_000);
    await settled;
  } finally {
    jest.useRealTimers();
  }
});
