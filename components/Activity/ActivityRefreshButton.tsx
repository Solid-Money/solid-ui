import { RefreshCw } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

type ActivityRefreshButtonProps = {
  onRefresh: () => void;
  isSyncing: boolean;
  isLoading: boolean;
};

export default function ActivityRefreshButton({
  onRefresh,
  isSyncing,
  isLoading,
}: ActivityRefreshButtonProps) {
  const isWeb = Platform.OS === 'web';
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      spinValue.setValue(0);
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinValue.stopAnimation();
      spinValue.setValue(0);
    }
  }, [isSyncing, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!isWeb) return null;

  return (
    <Pressable
      onPress={onRefresh}
      disabled={isLoading || isSyncing}
      className="flex-row items-center gap-2 rounded-full bg-card px-3 py-1.5 active:opacity-70"
    >
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <RefreshCw size={14} color={isLoading || isSyncing ? '#666' : '#fff'} />
      </Animated.View>
      <Text className="text-sm text-muted-foreground">{isSyncing ? 'Syncing...' : 'Refresh'}</Text>
    </Pressable>
  );
}
