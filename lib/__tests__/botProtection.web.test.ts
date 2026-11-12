/**
 * The web half of bot protection: a fresh, single-use Turnstile token on each
 * recovery, signup and account-lookup request, solved by one invisible widget,
 * and never a broken request when Turnstile can't produce one.
 */
import {
  getBotProtectionHeaders,
  resetBotProtectionForTests,
  TURNSTILE_HEADER,
} from '@/lib/botProtection.web';

jest.mock('@/lib/config', () => ({ EXPO_PUBLIC_TURNSTILE_SITE_KEY: 'site-key' }));

type Callbacks = {
  callback: (token: string) => void;
  'error-callback': () => boolean;
};

describe('getBotProtectionHeaders (web, Turnstile)', () => {
  let callbacks: Callbacks;
  let render: jest.Mock;
  let execute: jest.Mock;
  let reset: jest.Mock;
  /** What the next execute() answers with: a token, an error, or nothing. */
  let nextOutcome: { token?: string; error?: boolean } | null;

  const globals = globalThis as unknown as Record<string, unknown>;

  beforeEach(() => {
    jest.useRealTimers();
    resetBotProtectionForTests();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    nextOutcome = { token: 'turnstile-1' };

    render = jest.fn((_container: unknown, options: Callbacks) => {
      callbacks = options;
      return 'widget-1';
    });
    execute = jest.fn(() => {
      const outcome = nextOutcome;
      if (outcome?.token) callbacks.callback(outcome.token);
      else if (outcome?.error) callbacks['error-callback']();
    });
    reset = jest.fn();

    const element = () => ({ style: {}, setAttribute: jest.fn() });
    globals.window = { turnstile: { render, execute, reset } };
    globals.document = {
      createElement: jest.fn(element),
      body: { appendChild: jest.fn() },
      head: { appendChild: jest.fn() },
    };
  });

  afterEach(() => {
    delete globals.window;
    delete globals.document;
  });

  it('sends a Turnstile token, rendering one invisible widget', async () => {
    await expect(getBotProtectionHeaders()).resolves.toEqual({
      [TURNSTILE_HEADER]: 'turnstile-1',
    });
    expect(render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sitekey: 'site-key',
        execution: 'execute',
        appearance: 'interaction-only',
      }),
    );
    expect(execute).toHaveBeenCalledWith('widget-1');
  });

  it('gets a fresh token per request, reusing the widget', async () => {
    await getBotProtectionHeaders();
    nextOutcome = { token: 'turnstile-2' };

    await expect(getBotProtectionHeaders()).resolves.toEqual({
      [TURNSTILE_HEADER]: 'turnstile-2',
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith('widget-1');
  });

  it('solves concurrent requests one at a time, each with its own token', async () => {
    let count = 0;
    execute.mockImplementation(() => {
      count += 1;
      const token = `turnstile-${count}`;
      setTimeout(() => callbacks.callback(token), 0);
    });

    const [first, second] = await Promise.all([
      getBotProtectionHeaders(),
      getBotProtectionHeaders(),
    ]);
    expect([first[TURNSTILE_HEADER], second[TURNSTILE_HEADER]]).toEqual([
      'turnstile-1',
      'turnstile-2',
    ]);
  });

  it('sends nothing when the challenge fails', async () => {
    nextOutcome = { error: true };
    await expect(getBotProtectionHeaders()).resolves.toEqual({});
  });

  it('gives up on an abandoned challenge without hanging the request', async () => {
    jest.useFakeTimers();
    nextOutcome = null;

    const headers = getBotProtectionHeaders();
    await jest.advanceTimersByTimeAsync(30_000);

    await expect(headers).resolves.toEqual({});
  });

  it('gives up on a stalled script download, and tries again on the next request', async () => {
    jest.useFakeTimers();
    const turnstile = (globals.window as { turnstile?: unknown }).turnstile;
    delete (globals.window as { turnstile?: unknown }).turnstile;
    const scripts: { onload: (() => void) | null }[] = [];
    (globals.document as { head: { appendChild: jest.Mock } }).head.appendChild = jest.fn(script =>
      scripts.push(script),
    );

    // The download never finishes: neither onload nor onerror fires.
    const stalled = getBotProtectionHeaders();
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(stalled).resolves.toEqual({});

    // The next request loads the script afresh, and this time it arrives.
    const retried = getBotProtectionHeaders();
    await jest.advanceTimersByTimeAsync(0);
    expect(scripts).toHaveLength(2);
    (globals.window as { turnstile?: unknown }).turnstile = turnstile;
    scripts[1].onload?.();

    await expect(retried).resolves.toEqual({ [TURNSTILE_HEADER]: 'turnstile-1' });
  });
});
