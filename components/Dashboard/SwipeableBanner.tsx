import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { usePanGesture } from './PanGestureContext';

type SwipeableBannerProps = {
  children: ReactNode;
  onPress: () => void;
  className?: string;
};

const SwipeableBanner = ({
  children,
  onPress,
  className = 'flex-1 overflow-hidden rounded-twice',
}: SwipeableBannerProps) => {
  const isPanning = usePanGesture();

  const handlePress = () => {
    // Prevent press if carousel pan gesture was active
    const wasPanning = isPanning?.current ?? false;
    if (!wasPanning) {
      onPress();
    }
  };

  return (
    <View className={className}>
      <Pressable onPress={handlePress} className="flex-1">
        {children}
      </Pressable>
    </View>
  );
};

export default SwipeableBanner;
