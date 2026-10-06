import React from 'react';

import TierStar from '@/components/Rewards/NewRewards/TierHero/TierStar.ios';
import TierStarPreloadProvider from '@/components/Rewards/NewRewards/TierHero/TierStarPreload.ios';
import { RewardsTier } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');
const mockPlayers: {
  source: number;
  play: jest.Mock;
  pause: jest.Mock;
  release: jest.Mock;
  loop: boolean;
  muted: boolean;
  audioMixingMode?: string;
}[] = [];

jest.mock('@/assets/animations/star-1.mov', () => 1);
jest.mock('@/assets/animations/star-2.mov', () => 2);
jest.mock('@/assets/animations/star-3.mov', () => 3);
jest.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (source: number, setup: (player: (typeof mockPlayers)[number]) => void) => {
    const React = jest.requireActual('react');
    const ref = React.useRef(null);
    if (!ref.current) {
      let released = false;
      ref.current = {
        source,
        play: jest.fn(() => {
          if (released) throw new Error('Player already released');
        }),
        pause: jest.fn(() => {
          if (released) throw new Error('Player already released');
        }),
        release: jest.fn(() => {
          released = true;
        }),
        loop: false,
        muted: false,
      };
      setup(ref.current);
      mockPlayers.push(ref.current);
    }
    React.useEffect(() => () => ref.current.release(), []);
    return ref.current;
  },
}));

describe('iOS tier star playback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayers.length = 0;
  });

  it('warms the first frame, pauses offscreen, and resumes the same player', async () => {
    const ready = jest.fn();
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(<TierStar tier={RewardsTier.PRIME} playing={false} onReady={ready} />);
    });
    const mockPlayer = mockPlayers[0];
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
    const mockPlayer = mockPlayers[0];
    await act(async () => tree.root.findByType('VideoView').props.onFirstFrameRender());
    expect(mockPlayer.pause).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });

  it('loads every tier before opening benefits and reuses players across visits', async () => {
    const screen = (open: boolean) => (
      <TierStarPreloadProvider>
        {open &&
          [RewardsTier.CORE, RewardsTier.PRIME, RewardsTier.ULTRA].map(tier => (
            <TierStar key={tier} tier={tier} preload playing={tier === RewardsTier.CORE} />
          ))}
      </TierStarPreloadProvider>
    );
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(screen(false));
    });
    expect(mockPlayers.map(player => player.source)).toEqual([1, 2, 3]);
    for (const player of mockPlayers) {
      expect(player.play).not.toHaveBeenCalled();
      expect(player.loop).toBe(true);
      expect(player.muted).toBe(true);
      expect(player.audioMixingMode).toBe('mixWithOthers');
    }
    await act(async () => {
      tree.update(screen(true));
    });
    expect(mockPlayers).toHaveLength(3);
    const views = tree.root.findAllByType('VideoView');
    expect(views.map((view: { props: { player: unknown } }) => view.props.player)).toEqual(
      mockPlayers,
    );
    await act(async () =>
      views.forEach((view: { props: { onFirstFrameRender: () => void } }) =>
        view.props.onFirstFrameRender(),
      ),
    );
    expect(mockPlayers[0].pause).not.toHaveBeenCalled();
    expect(mockPlayers[1].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers[2].pause).toHaveBeenCalledTimes(1);
    await act(async () => {
      tree.update(screen(false));
    });
    expect(mockPlayers[0].pause).toHaveBeenCalledTimes(1);
    expect(mockPlayers.every(player => player.release.mock.calls.length === 0)).toBe(true);
    await act(async () => {
      tree.update(screen(true));
    });
    expect(mockPlayers).toHaveLength(3);
    await act(async () => tree.unmount());
    expect(mockPlayers.every(player => player.release.mock.calls.length === 1)).toBe(true);
  });

  it('keeps stars in popups independent from the preloaded pager players', async () => {
    let tree: ReturnType<typeof create>;
    await act(async () => {
      tree = create(
        <TierStarPreloadProvider>
          <TierStar tier={RewardsTier.CORE} preload />
          <TierStar tier={RewardsTier.CORE} />
        </TierStarPreloadProvider>,
      );
    });
    expect(mockPlayers).toHaveLength(4);
    const views = tree.root.findAllByType('VideoView');
    expect(views[0].props.player).toBe(mockPlayers[0]);
    expect(views[1].props.player).toBe(mockPlayers[3]);
    await act(async () => tree.unmount());
  });
});
