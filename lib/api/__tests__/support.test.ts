/// <reference types="jest" />

jest.mock('@/lib/config', () => ({
  EXPO_PUBLIC_SUPPORT_API_BASE_URL: 'https://support.example.com/',
}));
jest.mock('@/lib/api', () => ({
  getJWTToken: () => 'jwt-1',
  getPlatformHeaders: () => ({ 'X-Platform': 'ios' }),
}));
// One attempt is enough here; the refresh itself is the app's and has its own tests.
jest.mock('@/lib/utils', () => ({ withRefreshToken: (fn: () => unknown) => fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const support = require('@/lib/api/support') as typeof import('@/lib/api/support');

const json = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response;

describe('support API client', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('calls the support service with the session, and no user in the request', async () => {
    fetchMock.mockResolvedValue(json(200, { conversationId: 'c1' }));
    await support.getSupportThread();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://support.example.com/support/v1/thread');
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-1', 'X-Platform': 'ios' });
  });

  it('sends only the fields the server takes', async () => {
    fetchMock.mockResolvedValue(json(201, { message: {}, case: null }));
    await support.sendSupportMessage({
      clientMessageId: 'abcdefgh-1',
      body: 'hi',
      uploadIds: [],
      context: { kind: 'card_transaction', id: null },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      clientMessageId: 'abcdefgh-1',
      body: 'hi',
      context: { kind: 'card_transaction' },
    });
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('hands a 401 to the session refresh as the raw response', async () => {
    const unauthorized = json(401, {});
    fetchMock.mockResolvedValue(unauthorized);
    await expect(support.getSupportThread()).rejects.toBe(unauthorized);
  });

  it('turns a network failure into a retryable offline error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = await support.getSupportThread().catch(caught => caught);
    expect(error).toBeInstanceOf(support.SupportApiError);
    expect(error).toMatchObject({ status: 0, retryable: true });
  });

  it("shows the server's message for a refused request, and nothing it was sent", async () => {
    fetchMock.mockResolvedValue(json(400, { message: 'Unsupported file type' }));
    const error = await support
      .uploadSupportFile({ uri: 'file:///x.exe', name: 'x.exe', mime: 'application/x' })
      .catch(c => c);
    expect(error).toMatchObject({
      status: 400,
      message: 'Unsupported file type',
      retryable: false,
    });

    fetchMock.mockResolvedValue(json(500, { message: ['a', 'b'] }));
    const generic = await support.getSupportThread().catch(c => c);
    expect(generic).toMatchObject({
      status: 500,
      message: 'Something went wrong',
      retryable: true,
    });
  });

  it('uploads a native file as a form part without a JSON content type', async () => {
    fetchMock.mockResolvedValue(json(201, { id: 'u1' }));
    await support.uploadSupportFile({ uri: 'file:///a.jpg', name: 'a.jpg', mime: 'image/jpeg' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers['Content-Type']).toBeUndefined();
  });
});
