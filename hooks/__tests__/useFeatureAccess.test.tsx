import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useHasFeature } from '@/hooks/useFeatureAccess';
import { getFeatureAccess } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getFeatureAccess: jest.fn() }));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser.current }),
}));

const mockUser: { current: { userId: string } | undefined } = { current: undefined };
const mockGetFeatureAccess = getFeatureAccess as jest.MockedFunction<typeof getFeatureAccess>;

/** Mount the hook, let its query settle, and report what it answered. */
const run = async (feature: 'onramper' | 'cashout') => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const answers: boolean[] = [];
  const Probe = () => {
    answers.push(useHasFeature(feature));
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
  // React Query hands results to observers on a timer tick, not a microtask.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await act(async () => root.unmount());
  client.clear();
  return answers;
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockUser.current = { userId: 'user-1' };
});

it('answers with what the server says for that feature', async () => {
  mockGetFeatureAccess.mockResolvedValue({
    features: { cashApp: true, onramper: true, cashout: false },
  });

  expect((await run('onramper')).at(-1)).toBe(true);
  expect((await run('cashout')).at(-1)).toBe(false);
});

it('is closed until the server answers, so nothing flashes on', async () => {
  mockGetFeatureAccess.mockResolvedValue({ features: { onramper: true } });

  expect((await run('onramper'))[0]).toBe(false);
});

it('stays closed when the request fails', async () => {
  mockGetFeatureAccess.mockRejectedValue(new Error('offline'));

  expect(await run('onramper')).not.toContain(true);
});

it('stays closed for a feature the server does not name', async () => {
  mockGetFeatureAccess.mockResolvedValue({ features: {} });

  expect((await run('cashout')).at(-1)).toBe(false);
});

it('does not ask without a signed-in user', async () => {
  mockUser.current = undefined;

  expect(await run('onramper')).not.toContain(true);
  expect(mockGetFeatureAccess).not.toHaveBeenCalled();
});
