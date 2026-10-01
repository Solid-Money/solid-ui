import React from 'react';

import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar.ios';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockPlayer = { play: jest.fn(), pause: jest.fn(), loop: false, muted: false };

jest.mock('@/assets/animations/star-1.mov', () => 1);
jest.mock('@/assets/animations/star-2.mov', () => 2);
jest.mock('@/assets/animations/star-3.mov', () => 3);
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (_source: unknown, setup: (player: typeof mockPlayer) => void) => {
    const React = jest.requireActual('react');
    const initialized = React.useRef(false);
    if (!initialized.current) {
      setup(mockPlayer);
      initialized.current = true;
    }
    return mockPlayer;
  },
}));

describe('iOS tier star playback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('warms the first frame, pauses offscreen, and resumes the same player', async () => {
    const ready = jest.fn();
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TierStar tier={RewardsTier.PRIME} playing={false} onReady={ready} />);
    });
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    await act(async () => tree.root.findByType('VideoView').props.onFirstFrameRender());
    expect(ready).toHaveBeenCalledTimes(1);
    expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
    mockPlayer.play.mockClear();
    await act(async () => {
      tree.update(<TierStar tier={RewardsTier.PRIME} playing onReady={ready} />);
    });
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType('VideoView').props.player).toBe(mockPlayer);
    await act(async () => tree.unmount());
  });

  it('keeps a visible star playing after its first frame is ready', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TierStar tier={RewardsTier.CORE} playing />);
    });
    await act(async () => tree.root.findByType('VideoView').props.onFirstFrameRender());
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});
