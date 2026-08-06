import { useEffect, useRef, useState } from 'react';

const AV1_VIDEO_URL = '/videos/solid-login-hero-mobile-av1.webm';
const H264_VIDEO_URL = '/videos/solid-login-hero-mobile-h264.mp4';
const POSTER_URL = '/videos/solid-login-hero-mobile-poster.jpg';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function OnboardingHeroBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        video.pause();
      } else {
        void video.play().catch(() => {
          // The poster remains visible if the browser declines autoplay.
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <img
        src={POSTER_URL}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      aria-hidden="true"
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      controls={false}
      poster={POSTER_URL}
      preload="auto"
      tabIndex={-1}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center',
        pointerEvents: 'none',
      }}
    >
      <source src={AV1_VIDEO_URL} type='video/webm; codecs="av01.0.08M.08"' />
      <source src={H264_VIDEO_URL} type="video/mp4" />
    </video>
  );
}
