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
      // Play the full animation (gray outline → green accent → white fill)
      lottieRef.current?.play();
      hasPlayedInitial.current = true;
    } else if (hasPlayedInitial.current) {
      // Reset to frame 0 (gray outline state) when deselected
      lottieRef.current?.reset();
    }
  }, [focused]);

  return (
    <LottieView
      ref={lottieRef}
      source={source}
      autoPlay={focused}
      loop={false}
      style={{ width: 36, height: 36 }}
      resizeMode="contain"
    />
  );
}
