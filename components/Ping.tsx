import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const Ping = () => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pingAnimation = () => {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => {
        scaleAnim.setValue(1);
        opacityAnim.setValue(1);
        pingAnimation();
      });
    };

    pingAnimation();
  }, [scaleAnim, opacityAnim]);

  return (
    <View className="relative h-3.5 w-3.5">
      <Animated.View
        style={{
          width: 10,
          height: 10,
          position: 'absolute',
          top: '15%',
          left: '15%',
          backgroundColor: '#94F27F',
          borderRadius: 100,
          zIndex: -1,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      />
      <View className="relative h-3.5 w-3.5 rounded-full bg-gradient-to-br from-green-200 to-green-500" />
    </View>
  );
};

export default Ping;
