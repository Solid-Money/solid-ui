import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';

const VIDEO_SOURCE = require('../../../public/videos/solid-login-hero-mobile-h264.mp4');
const POSTER_SOURCE = require('../../../public/videos/solid-login-hero-mobile-poster.jpg');

export function OnboardingHeroBackground() {
  const [hasRenderedFirstFrame, setHasRenderedFirstFrame] = useState(false);
  const player = useVideoPlayer(VIDEO_SOURCE, videoPlayer => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.audioMixingMode = 'mixWithOthers';
    videoPlayer.play();
  });

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
        allowsVideoFrameAnalysis={false}
        onFirstFrameRender={() => setHasRenderedFirstFrame(true)}
      />

      {!hasRenderedFirstFrame && (
        <Image source={POSTER_SOURCE} alt="" style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
    </>
  );
}
