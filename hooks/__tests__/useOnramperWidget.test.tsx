import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { TRACKING_EVENTS } from '@/constants/tracking-events';
import useOnramperWidget from '@/hooks/useOnramperWidget';
import { track } from '@/lib/analytics';
import { fetchOnramperWidgetSession } from '@/lib/api';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('@/lib/analytics', () => ({ track: jest.fn() }));
jest.mock('@/lib/utils', () => ({
  withRefreshToken: <T,>(apiCall: () => Promise<T>) => apiCall(),
}));
jest.mock('@/lib/api', () => ({
  fetchOnramperWidgetSession: jest.fn(),
  fetchOnramperKycShareAvailability: jest.fn(),
}));

const mockFetchSession = fetchOnramperWidgetSession as jest.MockedFunction<
  typeof fetchOnramperWidgetSession
>;

/** Mount the hook and let its query settle. */
const run = async (shareKyc?: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Probe = () => {
    useOnramperWidget('wallet', shareKyc);
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
  await act(async () => root.unmount());
  client.clear();
};

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  mockFetchSession.mockResolvedValue({
    url: 'https://buy.onramper.com/?apiKey=pk',
    expiresAt: '2026-10-06T12:15:00.000Z',
    kycShared: true,
  });
});

it('asks for a shared session only with consent', async () => {
  await run(true);

  expect(mockFetchSession).toHaveBeenCalledWith(expect.any(String), 'wallet', true);
  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_RESULT, {
    shared: true,
  });
});

it('asks for a plain session by default, and reports nothing about sharing', async () => {
  await run();

  expect(mockFetchSession).toHaveBeenCalledWith(expect.any(String), 'wallet', false);
  expect(track).not.toHaveBeenCalled();
});

// The user agreed, but the backend could not share (stale approval, outage).
it('reports an agreed share that did not go through', async () => {
  mockFetchSession.mockResolvedValue({
    url: 'https://buy.onramper.com/?apiKey=pk',
    expiresAt: '2026-10-06T12:15:00.000Z',
    kycShared: false,
  });

  await run(true);

  expect(track).toHaveBeenCalledWith(TRACKING_EVENTS.ONRAMPER_KYC_SHARE_RESULT, {
    shared: false,
  });
});
