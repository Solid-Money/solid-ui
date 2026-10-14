/// <reference types="jest" />

jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_SUPPORT_API_BASE_URL: 'https://support.example.com/',
}));
jest.mock('@/lib/api', () => ({
  getJWTToken: () => null,
  getPlatformHeaders: () => ({ 'X-Platform': 'ios' }),
}));
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const help = require('@/lib/api/help') as typeof import('@/lib/api/help');

const json = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

describe('help center API client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('reads articles by slug, old Intercom ones included, and says when one moved', async () => {
    fetchMock.mockResolvedValue(json(200, { redirectTo: 'legal-privacy-policy' }));
    const result = await help.getHelpArticle('13184959-legal-privacy-policy-terms-conditions');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://support.example.com/support/v1/help/articles/13184959-legal-privacy-policy-terms-conditions',
    );
    expect(help.isHelpRedirect(result)).toBe(true);
    expect(help.isHelpRedirect({ slug: 'x' })).toBe(false);
  });

  it('searches with a trimmed, encoded query', async () => {
    fetchMock.mockResolvedValue(json(200, { results: [] }));
    await help.searchHelp('  apple pay & google  ');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://support.example.com/support/v1/help/search?q=apple%20pay%20%26%20google&limit=20',
    );
  });

  it('refuses a help home it cannot show, instead of handing it to the screen and the cache', async () => {
    const collection = {
      slug: 'cards',
      name: 'Cards',
      description: '',
      articleCount: 1,
      articles: [
        { id: 'a1', slug: 'apple-pay', title: 'Apple Pay', description: '', collection: null },
      ],
      children: [],
    };
    fetchMock.mockResolvedValueOnce(json(200, { collections: [collection], otherArticles: [] }));
    await expect(help.getHelpHome()).resolves.toEqual({
      collections: [collection],
      otherArticles: [],
    });

    for (const body of [
      { otherArticles: [] },
      { collections: null, otherArticles: [] },
      { collections: [{ ...collection, articles: undefined }], otherArticles: [] },
      { collections: [], otherArticles: [{ slug: 'x' }] },
    ]) {
      fetchMock.mockResolvedValueOnce(json(200, body));
      await expect(help.getHelpHome()).rejects.toMatchObject({ status: 502 });
    }
  });

  it('votes on the exact version that was read', async () => {
    fetchMock.mockResolvedValue(json(200, { recorded: true }));
    await help.sendHelpFeedback('a1', 'v9', false);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://support.example.com/support/v1/help/articles/a1/feedback');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ versionId: 'v9', helpful: false });
  });
});
