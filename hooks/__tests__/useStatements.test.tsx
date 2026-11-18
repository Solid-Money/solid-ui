import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { formatStatementMonth, useStatements } from '@/hooks/useStatements';
import { track } from '@/lib/analytics';
import { downloadStatement, getAvailableStatements } from '@/lib/api';
import { saveStatementFile } from '@/lib/statementFile';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/api', () => ({
  getAvailableStatements: jest.fn(),
  downloadStatement: jest.fn(),
}));
jest.mock('@/lib/statementFile', () => ({ saveStatementFile: jest.fn() }));
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/store/useUserStore', () => ({
  useUserStore: (selector: (state: unknown) => unknown) =>
    selector({ users: [{ userId: 'user-1', selected: true }] }),
}));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: (call: () => Promise<unknown>) => call(),
}));

const MONTHS = [
  { month: '2026-10', cardSpendUsd: '1284.50', partial: true },
  { month: '2026-09', cardSpendUsd: '1102.18', partial: false },
];
const mockGetAvailable = getAvailableStatements as jest.MockedFunction<
  typeof getAvailableStatements
>;
const mockDownload = downloadStatement as jest.MockedFunction<typeof downloadStatement>;
const mockSave = saveStatementFile as jest.MockedFunction<typeof saveStatementFile>;

type Hook = ReturnType<typeof useStatements>;

/** Mount the hook, let its query settle, and hand back its latest answer. */
const mount = async () => {
  // gcTime Infinity: no garbage-collection timers left running to hold Jest open.
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
  const answers: Hook[] = [];
  const Probe = () => {
    answers.push(useStatements());
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
  return {
    latest: () => answers.at(-1),
    unmount: async () => {
      await act(async () => root.unmount());
      client.clear();
    },
  };
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockGetAvailable.mockResolvedValue({ months: MONTHS });
});

it('names months the way the statement does, in UTC', () => {
  expect(formatStatementMonth('2026-09')).toBe('September 2026');
  expect(formatStatementMonth('2026-01')).toBe('January 2026');
});

it('lists the months the server offers', async () => {
  const { latest, unmount } = await mount();
  expect(latest()?.months).toEqual(MONTHS);
  await unmount();
});

it('downloads the month in the chosen form and hands the file over', async () => {
  const file = {
    filename: 'solid-statement-2026-09.pdf',
    content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    mimeType: 'application/pdf',
  };
  mockDownload.mockResolvedValue(file);
  mockSave.mockResolvedValue('saved');
  const { latest, unmount } = await mount();

  let result: unknown;
  await act(async () => {
    result = await latest()?.download('2026-09', 'pdf');
  });

  expect(result).toBe('saved');
  expect(mockDownload).toHaveBeenCalledWith('2026-09', 'pdf');
  expect(mockSave).toHaveBeenCalledWith(file);
  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.STATEMENT_DOWNLOAD_TAPPED, {
    month: '2026-09',
    format: 'pdf',
  });
  expect(latest()?.pendingMonth).toBeNull();
  await unmount();
});

it('reports a failed download and clears the spinner', async () => {
  mockDownload.mockRejectedValue(new Error('503'));
  const { latest, unmount } = await mount();

  await act(async () => {
    await expect(latest()?.download('2026-09', 'csv')).rejects.toThrow();
  });

  expect(mockSave).not.toHaveBeenCalled();
  expect(track).toHaveBeenCalledWith(
    TRACKING_EVENTS.STATEMENT_DOWNLOAD_FAILED,
    expect.objectContaining({ month: '2026-09', format: 'csv' }),
  );
  expect(latest()?.pendingMonth).toBeNull();
  await unmount();
});
