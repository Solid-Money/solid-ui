import React from 'react';
import { useQuery } from '@tanstack/react-query';

import { useWhatsNew } from '@/hooks/useWhatsNew';
import { WhatsNew } from '@/lib/types';
import { useWhatsNewStore } from '@/store/useWhatsNewStore';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

const mockStorage = new Map<string, string>();

jest.mock('@/lib/mmvkStorage', () => ({
  __esModule: true,
  default: () => ({
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
  }),
}));

jest.mock('@/lib/api', () => ({ fetchLatestWhatsNew: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));

const announcement: WhatsNew = {
  _id: 'new-announcement',
  isActive: true,
  showOnLoad: true,
  steps: [],
  createdAt: '2026-09-27T00:00:00.000Z',
};

const Probe = ({ ready }: { ready: boolean }) => {
  useWhatsNew(ready);
  return null;
};

describe('useWhatsNew auto-open', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockStorage.clear();
    useWhatsNewStore.setState({ whatsNew: announcement, isVisible: false });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, refetch: jest.fn() });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('waits three seconds after Home becomes ready', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Probe ready={false} />);
    });

    act(() => jest.advanceTimersByTime(10000));
    expect(useWhatsNewStore.getState().isVisible).toBe(false);

    await act(async () => renderer!.update(<Probe ready />));
    act(() => jest.advanceTimersByTime(2999));
    expect(useWhatsNewStore.getState().isVisible).toBe(false);

    act(() => jest.advanceTimersByTime(1));
    expect(useWhatsNewStore.getState().isVisible).toBe(true);
    act(() => renderer!.unmount());
  });

  it('cancels the pending open when Home is left', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Probe ready />);
    });

    act(() => jest.advanceTimersByTime(1500));
    await act(async () => renderer!.update(<Probe ready={false} />));
    act(() => jest.advanceTimersByTime(5000));

    expect(useWhatsNewStore.getState().isVisible).toBe(false);
    act(() => renderer!.unmount());
  });
});
