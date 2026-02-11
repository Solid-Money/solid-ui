import { useEffect, useRef } from 'react';
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

  return (
    <LottieView
      ref={lottieRef}
      source={source}
      autoPlay={focused}
      loop={false}
      style={{ width: 40, height: 40 }}
      resizeMode="contain"
    />
  );
}
