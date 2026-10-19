import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { isVaultOffered, useEurVaultAccess } from '@/hooks/useEurVaultAccess';
import { getEurVaultAccess } from '@/lib/api';
import { VaultType } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({ getEurVaultAccess: jest.fn() }));
jest.mock('@/lib/config', () => ({
  get isDevFeatureEnabled() {
    return mockIsDevBuild.current;
  },
}));
jest.mock('@/hooks/useUser', () => ({
  __esModule: true,
  default: () => ({ user: mockUser.current }),
}));

const mockIsDevBuild = { current: false };
const mockUser: { current: { userId: string } | undefined } = { current: undefined };
const mockGetEurVaultAccess = getEurVaultAccess as jest.MockedFunction<typeof getEurVaultAccess>;

/** Mount the hook, let its query settle, and report every answer it gave. */
const run = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const answers: boolean[] = [];
  const Probe = () => {
    answers.push(useEurVaultAccess().isEnabled);
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
  mockIsDevBuild.current = false;
  mockUser.current = { userId: 'user-1' };
});

describe('useEurVaultAccess in production', () => {
  it('offers the vault to a Wirex test user', async () => {
    mockGetEurVaultAccess.mockResolvedValue({ enabled: true, reason: 'cohort' });

    expect((await run()).at(-1)).toBe(true);
  });

  it('hides it from everyone else', async () => {
    mockGetEurVaultAccess.mockResolvedValue({ enabled: false, reason: 'not-in-cohort' });

    expect(await run()).not.toContain(true);
  });

  it('is closed until the server answers, so it never flashes on', async () => {
    mockGetEurVaultAccess.mockResolvedValue({ enabled: true, reason: 'cohort' });

    expect((await run())[0]).toBe(false);
  });

  it('stays closed when the request fails', async () => {
    mockGetEurVaultAccess.mockRejectedValue(new Error('offline'));

    expect(await run()).not.toContain(true);
  });

  it('does not ask without a signed-in user', async () => {
    mockUser.current = undefined;

    expect(await run()).not.toContain(true);
    expect(mockGetEurVaultAccess).not.toHaveBeenCalled();
  });
});

it('offers the vault to everyone on a QA/preview build, without asking', async () => {
  mockIsDevBuild.current = true;

  expect(await run()).toEqual(expect.arrayContaining([true]));
  expect(mockGetEurVaultAccess).not.toHaveBeenCalled();
});

it('gates only the EUR vault', () => {
  expect(isVaultOffered(VaultType.EUR, false)).toBe(false);
  expect(isVaultOffered(VaultType.EUR, true)).toBe(true);
  for (const type of [VaultType.USDC, VaultType.ETH, VaultType.FUSE]) {
    expect(isVaultOffered(type, false)).toBe(true);
  }
});
