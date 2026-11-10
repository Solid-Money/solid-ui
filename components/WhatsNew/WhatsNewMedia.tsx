import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play, Volume2, VolumeX, X } from 'lucide-react-native';

import type { WhatsNewMedia as WhatsNewMediaData } from '@/lib/types';
import type { Size } from '@/lib/whatsNew';

/** Spec: a video that hasn't drawn a frame by now stays on its poster. */
const VIDEO_START_TIMEOUT_MS = 5000;

/** Spec: 32pt dark circles, 12pt in from the corner, with a 44pt tap area. */
const BUTTON_SIZE = 32;
const BUTTON_INSET = 12;
const HIT_SIZE = 44;
const HIT_OFFSET = BUTTON_INSET - (HIT_SIZE - BUTTON_SIZE) / 2;

const POPUP_RADIUS = 20;
const DRAWER_RADIUS = 24;

/** Spec: 0 24 48 at 50% black. A drawer's falls above it, toward the screen. */
const POPUP_SHADOW = '0px 24px 48px rgba(0, 0, 0, 0.5)';
const DRAWER_SHADOW = '0px -24px 48px rgba(0, 0, 0, 0.5)';

/** Reads how long the video has played, for `watched_seconds`. */
export type WatchedSecondsReader = { current: (() => number) | null };

export interface WhatsNewMediaProps {
  media: WhatsNewMediaData;
  size: Size;
  /** Popup: every corner rounded. Drawer: top corners only, with the grab handle. */
  variant: 'popup' | 'drawer';
  /** Plays while true. Set false the moment a close starts, so it stops at once. */
  isActive: boolean;
  /** Keeps the sound button clear of the home bar under a drawer. */
  bottomInset?: number;
  hasLink: boolean;
  onPress: () => void;
  onClose: () => void;
  onSoundOn?: () => void;
  watchedSecondsRef?: WatchedSecondsReader;
}

const CircleButton = ({
  onPress,
  accessibilityLabel,
  style,
  children,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  style: object;
  children: ReactNode;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    hitSlop={0}
    style={[styles.hitArea, style]}
    className="active:opacity-70 web:hover:opacity-80"
  >
    <View style={styles.circle}>{children}</View>
  </Pressable>
);

interface VideoLayerProps {
  media: WhatsNewMediaData;
  isActive: boolean;
  bottomInset: number;
  /** Drawn over the video and poster, under the play and sound buttons. */
  tapTarget: ReactNode;
  onSoundOn?: () => void;
  watchedSecondsRef?: WatchedSecondsReader;
}

/**
 * The video, muted, inline and looping, with its poster on top until the first
 * frame is drawn. The poster stays — as a still, still tappable — if the video
 * errors or hasn't started within 5 seconds, and with Reduce Motion on until
 * the play button is tapped. Pauses whenever the app leaves the foreground.
 */
const VideoLayer = ({
  media,
  isActive,
  bottomInset,
  tapTarget,
  onSoundOn,
  watchedSecondsRef,
}: VideoLayerProps) => {
  const reduceMotion = useReducedMotion();
  const [isAppActive, setIsAppActive] = useState(AppState.currentState !== 'background');
  const [playRequested, setPlayRequested] = useState(false);
  const [hasFirstFrame, setHasFirstFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const player = useVideoPlayer({ uri: media.url }, p => {
    p.loop = true;
    p.muted = true;
    // Muted, it must not stop the user's music or take the now-playing slot.
    p.audioMixingMode = 'mixWithOthers';
  });

  const shouldPlay = isActive && isAppActive && !failed && (!reduceMotion || playRequested);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      setIsAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'error') setFailed(true);
    });
    return () => subscription.remove();
  }, [player]);

  // Still on the poster after 5 seconds of trying: keep the poster.
  useEffect(() => {
    if (!shouldPlay || hasFirstFrame) return;
    const timer = setTimeout(() => setFailed(true), VIDEO_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasFirstFrame, shouldPlay]);

  // Time actually spent playing, for `watched_seconds`.
  const watchedMsRef = useRef(0);
  const playingSinceRef = useRef<number | null>(null);
  useEffect(() => {
    const subscription = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) {
        playingSinceRef.current ??= Date.now();
      } else if (playingSinceRef.current !== null) {
        watchedMsRef.current += Date.now() - playingSinceRef.current;
        playingSinceRef.current = null;
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    if (!watchedSecondsRef) return;
    watchedSecondsRef.current = () => {
      const running = playingSinceRef.current ? Date.now() - playingSinceRef.current : 0;
      return Math.round((watchedMsRef.current + running) / 100) / 10;
    };
    return () => {
      watchedSecondsRef.current = null;
    };
  }, [watchedSecondsRef]);

  const toggleSound = useCallback(() => {
    const nextMuted = !isMuted;
    player.muted = nextMuted;
    // With sound on it behaves like any other video: it takes the audio.
    player.audioMixingMode = nextMuted ? 'mixWithOthers' : 'auto';
    setIsMuted(nextMuted);
    if (!nextMuted) onSoundOn?.();
  }, [isMuted, onSoundOn, player]);

  const showPoster = failed || !hasFirstFrame;
  const showPlayButton = reduceMotion && !playRequested && !failed;
  const showSoundButton = !!media.hasAudio && !failed && hasFirstFrame;

  return (
    <>
      {!failed ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          playsInline
          allowsVideoFrameAnalysis={false}
          // TextureView clips to the rounded corners on Android; SurfaceView doesn't.
          surfaceType="textureView"
          onFirstFrameRender={() => setHasFirstFrame(true)}
          pointerEvents="none"
          accessible={false}
        />
      ) : null}

      {showPoster ? (
        <Image
          source={{ uri: media.posterUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          pointerEvents="none"
          accessible={false}
        />
      ) : null}

      {tapTarget}

      {showPlayButton ? (
        <View style={styles.center} pointerEvents="box-none">
          <Pressable
            onPress={() => setPlayRequested(true)}
            accessibilityRole="button"
            accessibilityLabel="Play video"
            className="h-14 w-14 items-center justify-center rounded-full bg-black/50 active:opacity-70"
          >
            <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      {showSoundButton ? (
        <CircleButton
          onPress={toggleSound}
          accessibilityLabel={isMuted ? 'Sound on' : 'Sound off'}
          style={{ left: HIT_OFFSET, bottom: HIT_OFFSET + bottomInset }}
        >
          {isMuted ? (
            <VolumeX size={16} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Volume2 size={16} color="#FFFFFF" strokeWidth={2} />
          )}
        </CircleButton>
      ) : null}
    </>
  );
};

/**
 * One What's New image or video: just the media, its shadow and the close X.
 * Any words are inside the media itself. Tapping it opens the link, if there
 * is one; without one, tapping does nothing.
 */
const WhatsNewMedia = ({
  media,
  size,
  variant,
  isActive,
  bottomInset = 0,
  hasLink,
  onPress,
  onClose,
  onSoundOn,
  watchedSecondsRef,
}: WhatsNewMediaProps) => {
  const isDrawer = variant === 'drawer';
  // Under the buttons rather than around them, so a tap on X or the sound
  // button never also counts as a tap on the media.
  const tapTarget = hasLink ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={media.alt}
      style={StyleSheet.absoluteFill}
      className="web:cursor-pointer"
    />
  ) : (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={media.alt}
      style={StyleSheet.absoluteFill}
    />
  );
  const radius = isDrawer
    ? { borderTopLeftRadius: DRAWER_RADIUS, borderTopRightRadius: DRAWER_RADIUS }
    : { borderRadius: POPUP_RADIUS };

  return (
    <View
      style={[
        {
          width: size.width,
          height: size.height,
          boxShadow: isDrawer ? DRAWER_SHADOW : POPUP_SHADOW,
        },
        radius,
      ]}
    >
      <View style={[StyleSheet.absoluteFill, radius, styles.clip]}>
        {media.type === 'video' ? (
          <VideoLayer
            media={media}
            isActive={isActive}
            bottomInset={bottomInset}
            tapTarget={tapTarget}
            onSoundOn={onSoundOn}
            watchedSecondsRef={watchedSecondsRef}
          />
        ) : (
          <>
            <Image
              source={{ uri: media.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessible={false}
            />
            {tapTarget}
          </>
        )}

        {isDrawer ? <View style={styles.handle} pointerEvents="none" /> : null}

        <CircleButton
          onPress={onClose}
          accessibilityLabel="Close"
          style={{ top: HIT_OFFSET, right: HIT_OFFSET }}
        >
          <X size={18} color="#FFFFFF" strokeWidth={2} />
        </CircleButton>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', backgroundColor: '#000000' },
  hitArea: {
    position: 'absolute',
    width: HIT_SIZE,
    height: HIT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Drawn over the media's top edge, light enough to read on any artwork.
  handle: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1,
  },
});

export default WhatsNewMedia;
