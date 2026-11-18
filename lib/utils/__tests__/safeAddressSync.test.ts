import { isSafeAlreadyLinked, linkSafeAddress, SAFE_LINK_ERROR } from '@/lib/utils/safeAddressSync';

jest.mock('@/lib/api', () => ({ updateSafeAddress: jest.fn() }));
jest.mock('@/lib/utils/utils', () => ({ withRefreshToken: jest.fn() }));

const SAFE = '0xFCcd30D17579b463AD43627a735a3C2B89aCd3A5';
const httpError = (status: number, code?: string) =>
  Object.assign(new Error('failed'), { status, code });

describe('isSafeAlreadyLinked', () => {
  it('treats the account’s own Safe, with or without a code, as linked', () => {
    expect(isSafeAlreadyLinked(httpError(409, SAFE_LINK_ERROR.ALREADY_SET))).toBe(true);
    expect(isSafeAlreadyLinked(httpError(409))).toBe(true);
  });

  it('does not treat a Safe held by another account as linked', () => {
    expect(isSafeAlreadyLinked(httpError(409, SAFE_LINK_ERROR.LINKED_TO_OTHER_ACCOUNT))).toBe(
      false,
    );
  });

  it('does not treat other failures as linked', () => {
    expect(isSafeAlreadyLinked(httpError(400))).toBe(false);
    expect(isSafeAlreadyLinked(httpError(403, 'SAFE_NOT_OWNED'))).toBe(false);
    expect(isSafeAlreadyLinked(httpError(503))).toBe(false);
    expect(isSafeAlreadyLinked(new Error('Network request failed'))).toBe(false);
  });
});

describe('linkSafeAddress', () => {
  const sleep = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => sleep.mockClear());

  it('resolves when the link succeeds or the Safe is already this account’s', async () => {
    await expect(
      linkSafeAddress(SAFE, { link: jest.fn().mockResolvedValue({ success: true }), sleep }),
    ).resolves.toBeUndefined();
    await expect(
      linkSafeAddress(SAFE, {
        link: jest.fn().mockRejectedValue(httpError(409, SAFE_LINK_ERROR.ALREADY_SET)),
        sleep,
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when another account holds the Safe', async () => {
    const link = jest
      .fn()
      .mockRejectedValue(httpError(409, SAFE_LINK_ERROR.LINKED_TO_OTHER_ACCOUNT));
    await expect(linkSafeAddress(SAFE, { link, sleep })).rejects.toMatchObject({ status: 409 });
    expect(link).toHaveBeenCalledTimes(1);
  });

  it('throws 400 and 403 at once, without retrying', async () => {
    for (const status of [400, 403]) {
      const link = jest.fn().mockRejectedValue(httpError(status));
      await expect(linkSafeAddress(SAFE, { link, sleep })).rejects.toMatchObject({ status });
      expect(link).toHaveBeenCalledTimes(1);
    }
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 503 after each delay and resolves once it links', async () => {
    const link = jest
      .fn()
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValueOnce({ success: true });
    await expect(
      linkSafeAddress(SAFE, { link, sleep, retryDelaysMs: [10, 20] }),
    ).resolves.toBeUndefined();
    expect(link).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it('gives up after the last delay and throws the 503', async () => {
    const link = jest.fn().mockRejectedValue(httpError(503));
    await expect(
      linkSafeAddress(SAFE, { link, sleep, retryDelaysMs: [10, 20] }),
    ).rejects.toMatchObject({ status: 503 });
    expect(link).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('does not retry at all when given no delays', async () => {
    const link = jest.fn().mockRejectedValue(httpError(503));
    await expect(linkSafeAddress(SAFE, { link, sleep, retryDelaysMs: [] })).rejects.toMatchObject({
      status: 503,
    });
    expect(link).toHaveBeenCalledTimes(1);
  });
});
