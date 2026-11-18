import { downloadStatement } from '@/lib/api';

jest.mock('@/constants/rewards', () => ({ MOCK_REWARDS_USER_DATA: {}, MOCK_TIER_BENEFITS: {} }));
jest.mock('@/store/useUserStore', () => ({ useUserStore: { getState: () => ({ users: [] }) } }));
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
jest.mock('axios', () => {
  const instance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  const axios = { ...instance, create: () => instance };
  return { __esModule: true, default: axios, ...axios };
});

const originalFetch = global.fetch;
const mockFetch = jest.fn();
beforeEach(() => {
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});

const respond = (disposition: string | null, body: { text?: string; bytes?: number[] }) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => (name === 'Content-Disposition' ? disposition : null) },
  text: async () => body.text ?? '',
  arrayBuffer: async () => new Uint8Array(body.bytes ?? []).buffer,
});

it('reads a PDF as bytes, named by the server', async () => {
  mockFetch.mockResolvedValue(
    respond('attachment; filename="solid-statement-2026-09.pdf"', { bytes: [0x25, 0x50, 0x44] }),
  );

  const file = await downloadStatement('2026-09', 'pdf');

  expect(mockFetch.mock.calls[0][0]).toContain('month=2026-09&format=pdf');
  expect(file.filename).toBe('solid-statement-2026-09.pdf');
  expect(file.mimeType).toBe('application/pdf');
  expect(file.content).toEqual(new Uint8Array([0x25, 0x50, 0x44]));
});

it('reads a CSV as text, and names it itself when the header is hidden', async () => {
  mockFetch.mockResolvedValue(respond(null, { text: 'Date,Description' }));

  const file = await downloadStatement('2026-10', 'csv');

  expect(mockFetch.mock.calls[0][0]).toContain('month=2026-10&format=csv');
  expect(file).toEqual({
    filename: 'solid-statement-2026-10.csv',
    content: 'Date,Description',
    mimeType: 'text/csv',
  });
});

it('hands a failed response back for the caller to read', async () => {
  const response = { ok: false, status: 503 };
  mockFetch.mockResolvedValue(response);
  await expect(downloadStatement('2026-09', 'pdf')).rejects.toBe(response);
});
