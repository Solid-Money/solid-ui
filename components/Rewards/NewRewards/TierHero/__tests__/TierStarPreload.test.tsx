import React from 'react';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

import TierStarPreloadProvider from '@/components/Rewards/NewRewards/TierHero/TierStarPreload';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

// jest-expo defaults to iOS; explicitly exercise the WebP provider here.
jest.mock('@/components/Rewards/NewRewards/TierHero/TierStarPreload', () =>
  jest.requireActual('@/components/Rewards/NewRewards/TierHero/TierStarPreload.tsx'),
);
jest.mock('@/components/Rewards/NewRewards/TierHero/TierStar', () => ({
  TIER_STAR_ANIMATIONS: { CORE: 1, PRIME: 2, ULTRA: 3 },
}));
jest.mock('expo-image', () => ({ Image: { prefetch: jest.fn(() => Promise.resolve(true)) } }));

describe('web and Android tier animation preloading', () => {
  afterEach(() => jest.restoreAllMocks());

  it('caches all three animations before displaying the page and only once per mount', async () => {
    jest
      .spyOn(Asset, 'fromModule')
      .mockImplementation(source => ({ uri: `star-${source}.webp` }) as unknown as Asset);
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TierStarPreloadProvider />);
    });
    expect(Image.prefetch).toHaveBeenCalledWith(
      ['star-1.webp', 'star-2.webp', 'star-3.webp'],
      'memory-disk',
    );
    await act(async () => {
      tree.update(
        <TierStarPreloadProvider>
          <></>
        </TierStarPreloadProvider>,
      );
    });
    expect(Image.prefetch).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
});
