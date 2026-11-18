import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useDepositTokensAccess } from '@/hooks/useDepositTokensAccess';
import { getDepositTokensAccess } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getDepositTokensAccess: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser.current }),
}));
// A qa/preview build: the build must not open the tokens by itself.
jest.mock('@/lib/config', () => ({ isDevFeatureEnabled: true, isProduction: false }));

const mockUser: { current: { userId: string } | undefined } = { current: undefined };
const mockGetAccess = getDepositTokensAccess as jest.MockedFunction<typeof getDepositTokensAccess>;

/** Let React Query hand its result to observers, which it does on a timer tick. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

/** Mount the hook and record every answer it gives, for `then` to drive further. */
const mount = async (then?: (client: QueryClient) => Promise<void>) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const answers: boolean[] = [];
  const Probe = () => {
    answers.push(useDepositTokensAccess().isEnabled);
    return null;
  };
  let root: any;
  await act(async () => {
    root = create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await settle();
  if (then) await then(client);
  await act(async () => root.unmount());
  client.clear();
  return answers;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUser.current = { userId: 'user-1' };
});

it('answers with what the server says, whatever the build', async () => {
  mockGetAccess.mockResolvedValue({ enabled: true, reason: 'cohort' });
  expect((await mount()).at(-1)).toBe(true);

  mockGetAccess.mockResolvedValue({ enabled: false, reason: 'not-in-cohort' });
  expect((await mount()).at(-1)).toBe(false);
  expect(mockGetAccess).toHaveBeenCalledTimes(2);
});

it('is closed until the server answers, so nothing flashes on', async () => {
  mockGetAccess.mockResolvedValue({ enabled: true, reason: 'cohort' });

  expect((await mount())[0]).toBe(false);
});

it('stays closed when the request fails', async () => {
  mockGetAccess.mockRejectedValue(new Error('offline'));

  expect(await mount()).not.toContain(true);
});

it('closes again when a later check fails, rather than trusting the old yes', async () => {
  mockGetAccess.mockResolvedValueOnce({ enabled: true, reason: 'cohort' });

  const answers = await mount(async client => {
    mockGetAccess.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await client.refetchQueries().catch(() => undefined);
    });
    await settle();
  });

  expect(answers).toContain(true);
  expect(answers.at(-1)).toBe(false);
});

it('does not ask without a signed-in user', async () => {
  mockUser.current = undefined;

  expect(await mount()).not.toContain(true);
  expect(mockGetAccess).not.toHaveBeenCalled();
});
