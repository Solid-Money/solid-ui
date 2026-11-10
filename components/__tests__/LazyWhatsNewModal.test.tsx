import React from 'react';
import { Image } from 'expo-image';

import LazyWhatsNewModal from '@/components/LazyWhatsNewModal';

import type { WhatsNew } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn() } }));
// Dynamic import() can't run under this Jest setup; see the stub.
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('@/lib/lazyWithRetry', () => require('./lazyBundleStub'));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const prefetch = Image.prefetch as unknown as jest.Mock;

const VIDEO_SINGLE: WhatsNew = {
  _id: 'single-1',
  format: 'single',
  presentation: 'drawer',
  media: {
    type: 'video',
    url: 'https://cdn.test/new.mp4',
    posterUrl: 'https://cdn.test/new-poster.jpg',
    width: 1080,
    height: 1350,
    alt: 'Swap in two taps',
  },
  steps: [],
  isActive: true,
  showOnLoad: true,
  createdAt: '2026-11-04T00:00:00.000Z',
};

const CAROUSEL: WhatsNew = {
  _id: 'carousel-1',
  steps: [{ imageUrl: 'https://cdn.test/step.png', title: 'Euro', text: 'Pay 0 fees.' }],
  isActive: true,
  showOnLoad: true,
  createdAt: '2026-10-10T00:00:00.000Z',
};

const render = async (whatsNew: WhatsNew) => {
  const onFailed = jest.fn();
  let renderer: ReturnType<typeof create>;
  await act(async () => {
    renderer = create(
      <LazyWhatsNewModal whatsNew={whatsNew} isOpen onClose={jest.fn()} onFailed={onFailed} />,
    );
  });
  // Let the prefetch settle.
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return { renderer: renderer!, onFailed };
};

describe('LazyWhatsNewModal', () => {
  beforeEach(() => prefetch.mockReset());

  it('waits on the video poster, not the video, then shows the single', async () => {
    prefetch.mockResolvedValue(true);
    const { renderer, onFailed } = await render(VIDEO_SINGLE);

    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenCalledWith('https://cdn.test/new-poster.jpg', 'memory-disk');
    expect(onFailed).not.toHaveBeenCalled();
    expect(renderer.toJSON()).toBe('single-popup');
    act(() => renderer.unmount());
  });

  it('shows nothing and reports a failure when the poster fails to load', async () => {
    prefetch.mockResolvedValue(false);
    const { renderer, onFailed } = await render(VIDEO_SINGLE);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());
  });

  it('treats a prefetch error as a failure too', async () => {
    prefetch.mockRejectedValue(new Error('offline'));
    const { renderer, onFailed } = await render(VIDEO_SINGLE);

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(renderer.toJSON()).toBeNull();
    act(() => renderer.unmount());
  });

  it('still shows a carousel once its requests settle, as before', async () => {
    prefetch.mockResolvedValue(false);
    const { renderer, onFailed } = await render(CAROUSEL);

    expect(onFailed).not.toHaveBeenCalled();
    expect(renderer.toJSON()).toBe('carousel-popup');
    act(() => renderer.unmount());
  });
});
