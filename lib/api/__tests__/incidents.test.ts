/// <reference types="jest" />

jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_SUPPORT_API_BASE_URL: 'https://support.example.com/',
  USER: { storageKey: 'incidents-test-user' },
}));
jest.mock('@/lib/mmvkStorage', () => () => ({
  getItem: () => null,
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
jest.mock('@/lib/api', () => ({
  getJWTToken: () => null,
  getPlatformHeaders: () => ({ 'X-Platform': 'ios' }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('@/lib/api/incidents') as typeof import('@/lib/api/incidents');

const json = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

describe('known incidents API client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reads /support/v1/incidents and keeps only what the notice can show', async () => {
    const good = {
      id: 'inc_0123456789ab',
      title: ' Card payments are delayed ',
      message: 'Some card payments are slower.',
      active: true,
      startedAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-29T10:00:00.000Z',
      resolvedAt: null,
    };
    fetchMock.mockResolvedValue(
      json(200, {
        incidents: [
          good,
          { ...good, id: '' },
          { ...good, id: 'no-title', title: '  ' },
          { ...good, id: 'bad-time', updatedAt: 'soon' },
          { ...good, id: 'older-server', startedAt: undefined, resolvedAt: undefined },
          null,
        ],
      }),
    );
    const incidents = await api.getKnownIncidents();
    expect(fetchMock.mock.calls[0][0]).toBe('https://support.example.com/support/v1/incidents');
    expect(incidents.map(incident => incident.id)).toEqual(['inc_0123456789ab', 'older-server']);
    expect(incidents[0].title).toBe('Card payments are delayed');
    expect(incidents[1]).toMatchObject({ startedAt: null, resolvedAt: null });
  });

  it('treats an unexpected body as no incidents', async () => {
    fetchMock.mockResolvedValue(json(200, { incidents: 'none' }));
    await expect(api.getKnownIncidents()).resolves.toEqual([]);
  });
});
