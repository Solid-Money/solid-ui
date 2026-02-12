import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';

interface LottieTabIconProps {
  source: LottieViewProps['source'];
  focused: boolean;
}

export function LottieTabIcon({ source, focused }: LottieTabIconProps) {
  const lottieRef = useRef<LottieView>(null);
  const hasPlayedInitial = useRef(false);

  useEffect(() => {
    if (focused) {
      lottieRef.current?.play();
      hasPlayedInitial.current = true;
    } else if (hasPlayedInitial.current) {
      lottieRef.current?.reset();
    }
  }, [focused]);

  const size = Platform.OS === 'web' ? 36 : 40;

  return (
    <LottieView
      ref={lottieRef}
      source={source}
      autoPlay={focused}
      loop={false}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
