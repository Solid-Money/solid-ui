import { Cooldown, createBatchedLoader } from '@/lib/batchedLoader';

const TTL = 60_000;
const MISS_TTL = 300_000;
const ERROR_TTL = 15_000;
const MAX_STALE = 600_000;

let clock = 0;
const rateLimited = Object.assign(new Error('429'), { rateLimited: true });

const setup = (options: { cooldown?: Cooldown; chunkSize?: number } = {}) => {
  const fetchChunk = jest.fn(async (keys: string[]) => {
    const values = new Map<string, number>();
    for (const key of keys) if (!key.startsWith('missing')) values.set(key, key.length);
    return values;
  });
  const loader = createBatchedLoader<number>({
    chunk: keys => {
      const size = options.chunkSize ?? 25;
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += size) chunks.push(keys.slice(i, i + size));
      return chunks;
    },
    fetchChunk,
    ttlMs: TTL,
    missTtlMs: MISS_TTL,
    errorTtlMs: ERROR_TTL,
    maxStaleMs: MAX_STALE,
    cooldownMs: error => ((error as { rateLimited?: boolean }).rateLimited ? 60_000 : undefined),
    cooldown: options.cooldown,
    now: () => clock,
  });
  return { loader, fetchChunk };
};

beforeEach(() => {
  clock = 1_000_000;
});

describe('createBatchedLoader', () => {
  it('answers lookups started in the same tick with one request', async () => {
    const { loader, fetchChunk } = setup();

    const [a, b, c] = await Promise.all([
      loader.load(['ETH']),
      loader.load(['BNB', 'ETH']),
      loader.load(['FUSE']),
    ]);

    expect(fetchChunk).toHaveBeenCalledTimes(1);
    expect(fetchChunk).toHaveBeenCalledWith(['ETH', 'BNB', 'FUSE']);
    expect(a).toEqual(new Map([['ETH', 3]]));
    expect(b).toEqual(
      new Map([
        ['BNB', 3],
        ['ETH', 3],
      ]),
    );
    expect(c).toEqual(new Map([['FUSE', 4]]));
  });

  it('splits one flush into the chunks the upstream accepts', async () => {
    const { loader, fetchChunk } = setup({ chunkSize: 2 });

    await loader.load(['a', 'b', 'c', 'd', 'e']);

    expect(fetchChunk.mock.calls).toEqual([[['a', 'b']], [['c', 'd']], [['e']]]);
  });

  it('joins a request already in flight instead of sending another', async () => {
    const { loader, fetchChunk } = setup();
    let respond: (values: Map<string, number>) => void = () => {};
    fetchChunk.mockImplementationOnce(() => new Promise(resolve => (respond = resolve)));

    const first = loader.load(['ETH']);
    await new Promise(resolve => setTimeout(resolve, 0)); // the first request is now out
    expect(fetchChunk).toHaveBeenCalledTimes(1);
    const second = loader.load(['ETH']);
    respond(new Map([['ETH', 3]]));

    await expect(Promise.all([first, second])).resolves.toEqual([
      new Map([['ETH', 3]]),
      new Map([['ETH', 3]]),
    ]);
    expect(fetchChunk).toHaveBeenCalledTimes(1);
  });

  it('serves a value from cache until its TTL runs out', async () => {
    const { loader, fetchChunk } = setup();

    await loader.load(['ETH']);
    clock += TTL - 1;
    await loader.load(['ETH']);
    expect(fetchChunk).toHaveBeenCalledTimes(1);

    clock += 1;
    await loader.load(['ETH']);
    expect(fetchChunk).toHaveBeenCalledTimes(2);
  });

  it('remembers a key upstream had no value for', async () => {
    const { loader, fetchChunk } = setup();

    await expect(loader.load(['missing-token'])).resolves.toEqual(new Map());
    clock += MISS_TTL - 1;
    await expect(loader.load(['missing-token'])).resolves.toEqual(new Map());
    expect(fetchChunk).toHaveBeenCalledTimes(1);

    clock += 1;
    await loader.load(['missing-token']);
    expect(fetchChunk).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the last value while a refresh fails, then retries after the error TTL', async () => {
    const { loader, fetchChunk } = setup();
    await loader.load(['ETH']);

    clock += TTL;
    fetchChunk.mockRejectedValueOnce(new Error('network down'));
    await expect(loader.load(['ETH'])).resolves.toEqual(new Map([['ETH', 3]]));
    expect(fetchChunk).toHaveBeenCalledTimes(2);

    clock += ERROR_TTL - 1;
    await loader.load(['ETH']);
    expect(fetchChunk).toHaveBeenCalledTimes(2);

    clock += 1;
    await loader.load(['ETH']);
    expect(fetchChunk).toHaveBeenCalledTimes(3);
  });

  it('drops a value once it is older than the stale limit', async () => {
    const { loader, fetchChunk } = setup();
    await loader.load(['ETH']);

    fetchChunk.mockRejectedValue(new Error('network down'));
    clock += MAX_STALE + 1;

    await expect(loader.load(['ETH'])).resolves.toEqual(new Map());
  });

  it('pauses every loader sharing a cooldown after a rate limit', async () => {
    const cooldown = { until: 0 };
    const symbols = setup({ cooldown });
    const addresses = setup({ cooldown });
    symbols.fetchChunk.mockRejectedValueOnce(rateLimited);

    await expect(symbols.loader.load(['ETH'])).resolves.toEqual(new Map());
    await expect(addresses.loader.load(['8453:0xabc'])).resolves.toEqual(new Map());
    await symbols.loader.load(['BNB']);
    expect(symbols.fetchChunk).toHaveBeenCalledTimes(1);
    expect(addresses.fetchChunk).not.toHaveBeenCalled();

    clock += 60_000;
    await addresses.loader.load(['8453:0xabc']);
    expect(addresses.fetchChunk).toHaveBeenCalledTimes(1);
  });

  it('never rejects, even when splitting the keys throws', async () => {
    const loader = createBatchedLoader<number>({
      chunk: () => {
        throw new Error('bad chunking');
      },
      fetchChunk: jest.fn(),
      ttlMs: TTL,
      missTtlMs: MISS_TTL,
      errorTtlMs: ERROR_TTL,
      maxStaleMs: MAX_STALE,
      now: () => clock,
    });

    await expect(loader.load(['ETH'])).resolves.toEqual(new Map());
  });

  it('forgets cached values and lifts the pause on clear', async () => {
    const cooldown = { until: 0 };
    const { loader, fetchChunk } = setup({ cooldown });
    await loader.load(['ETH']);
    cooldown.until = clock + 60_000;

    loader.clear();
    await loader.load(['ETH']);

    expect(cooldown.until).toBe(0);
    expect(fetchChunk).toHaveBeenCalledTimes(2);
  });
});
