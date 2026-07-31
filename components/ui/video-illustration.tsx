import { useEffect } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, type VideoContentFit, VideoView } from 'expo-video';

interface VideoIllustrationProps {
  /** A `require()`d mp4. */
  source: number;
  /** Plays when true; pauses and rewinds to the first frame when false. */
  isActive: boolean;
  /** Change this to replay from the start while staying active. */
  restartKey?: number | string;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
  contentFit?: VideoContentFit;
  /** Fires once the first frame is actually on screen. */
  onReady?: () => void;
}

/**
 * A decorative, silent motion graphic played as video.
 *
 * These illustrations used to be animated WebPs rendered by expo-image. On iOS
 * that path decodes every frame on demand through SDWebImage and can't buffer a
 * clip of this length, so playback stalls and recovers in a visible cycle. The
 * same artwork as H.264 is hardware-decoded on both platforms, costs a fraction
 * of the CPU, and is roughly a fifth of the file size.
 *
 * Playback is driven by `isActive` rather than by mounting and unmounting, so
 * callers no longer need the `key`-remount trick to rewind to frame zero.
 *
 * Requires a dev client containing expo-video (added 2026-07-30).
 */
const VideoIllustration = ({
  source,
  isActive,
  restartKey,
  loop = false,
  style,
  contentFit = 'contain',
  onReady,
}: VideoIllustrationProps) => {
  const player = useVideoPlayer(source, p => {
    p.loop = loop;
    p.muted = true;
    // Decorative, so never interrupt the user's audio or take the
    // now-playing slot.
    p.audioMixingMode = 'mixWithOthers';
  });

  useEffect(() => {
    if (isActive) {
      // replay() rewinds and plays in one step, so re-selecting a slide
      // restarts its animation from the beginning.
      player.replay();
    } else {
      player.pause();
      player.currentTime = 0;
    }
  }, [isActive, restartKey, player]);

  return (
    <VideoView
      player={player}
      style={style}
      contentFit={contentFit}
      nativeControls={false}
      allowsVideoFrameAnalysis={false}
      onFirstFrameRender={onReady}
      pointerEvents="none"
      accessible={false}
    />
  );
};

export default VideoIllustration;
