import React from 'react';
import { onlineManager, useQuery } from '@tanstack/react-query';

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
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  onlineManager: { isOnline: jest.fn(() => true) },
}));

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

describe('useWhatsNew opening a linked page', () => {
  const ID = '000000000000000000000001';
  const step = (title: string) => ({ title, text: '', imageUrl: '' });
  const active: WhatsNew = {
    ...announcement,
    _id: ID,
    showOnLoad: false,
    steps: [step('Card'), step('Euro yield'), step('Credit')],
  };

  const render = async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Probe ready={false} />);
    });
    return renderer!;
  };

  const request = async (id: string, page: number) => {
    await act(async () => {
      useWhatsNewStore.getState().requestWhatsNew(id, page);
    });
  };

  /** What the server answers a link's refetch with. */
  const serverHas = (latest: WhatsNew | null) => {
    const refetch = jest.fn().mockResolvedValue({ isSuccess: true, data: latest });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, refetch });
    return refetch;
  };

  beforeEach(() => {
    mockStorage.clear();
    useWhatsNewStore.setState({
      whatsNew: active,
      isVisible: false,
      initialStep: 0,
      request: null,
    });
    (onlineManager.isOnline as jest.Mock).mockReturnValue(true);
    serverHas(active);
  });

  it('opens the announcement on the page the link named', async () => {
    const renderer = await render();
    await request(ID, 2);

    expect(useWhatsNewStore.getState()).toMatchObject({
      isVisible: true,
      initialStep: 2,
      request: null,
    });
    act(() => renderer.unmount());
  });

  it('opens on the last page when the link names one that was since removed', async () => {
    const renderer = await render();
    await request(ID, 7);

    expect(useWhatsNewStore.getState().initialStep).toBe(2);
    act(() => renderer.unmount());
  });

  it('opens the announcement that replaced the linked one on its first page', async () => {
    const replacement: WhatsNew = { ...active, _id: 'ffffffffffffffffffffffff' };
    const refetch = serverHas(replacement);
    useWhatsNewStore.setState({ whatsNew: null });

    const renderer = await render();
    await request(ID, 2);

    expect(refetch).toHaveBeenCalled();
    expect(useWhatsNewStore.getState()).toMatchObject({
      whatsNew: replacement,
      isVisible: true,
      initialStep: 0,
      request: null,
    });
    act(() => renderer.unmount());
  });

  it('asks the server even when the stored copy is the linked announcement', async () => {
    // Stored this session, replaced on the server since.
    const replacement: WhatsNew = { ...active, _id: 'ffffffffffffffffffffffff' };
    const refetch = serverHas(replacement);

    const renderer = await render();
    await request(ID, 2);

    expect(refetch).toHaveBeenCalled();
    expect(useWhatsNewStore.getState()).toMatchObject({
      whatsNew: replacement,
      isVisible: true,
      initialStep: 0,
    });
    act(() => renderer.unmount());
  });

  it('opens nothing when no announcement is active', async () => {
    serverHas(null);
    useWhatsNewStore.setState({ whatsNew: null });

    const renderer = await render();
    await request(ID, 1);

    expect(useWhatsNewStore.getState()).toMatchObject({ isVisible: false, request: null });
    act(() => renderer.unmount());
  });

  it('does not revive a stored announcement the server has switched off', async () => {
    serverHas(null);

    const renderer = await render();
    await request(ID, 1);

    expect(useWhatsNewStore.getState()).toMatchObject({ isVisible: false, request: null });
    act(() => renderer.unmount());
  });

  it('opens the stored copy when the server cannot be reached', async () => {
    const refetch = jest
      .fn()
      .mockResolvedValue({ isSuccess: false, isError: true, data: undefined });
    (useQuery as jest.Mock).mockReturnValue({ data: undefined, refetch });

    const renderer = await render();
    await request(ID, 1);

    expect(useWhatsNewStore.getState()).toMatchObject({
      whatsNew: active,
      isVisible: true,
      initialStep: 1,
    });
    act(() => renderer.unmount());
  });

  it('opens the stored copy offline without waiting for a connection', async () => {
    (onlineManager.isOnline as jest.Mock).mockReturnValue(false);
    const refetch = serverHas(null);

    const renderer = await render();
    await request(ID, 2);

    expect(refetch).not.toHaveBeenCalled();
    expect(useWhatsNewStore.getState()).toMatchObject({ isVisible: true, initialStep: 2 });
    act(() => renderer.unmount());
  });

  it('starts the next opening at the top once the linked one is closed', async () => {
    const seen: ReturnType<typeof useWhatsNew>[] = [];
    const Capture = () => {
      seen.push(useWhatsNew(false));
      return null;
    };
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(<Capture />);
    });
    await request(ID, 1);
    expect(useWhatsNewStore.getState().initialStep).toBe(1);

    act(() => seen[seen.length - 1].closeWhatsNew());

    expect(useWhatsNewStore.getState()).toMatchObject({ isVisible: false, initialStep: 0 });
    act(() => renderer!.unmount());
  });
});
