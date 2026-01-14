import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { Text } from '@/components/ui/text';

type TabButtonProps = {
  label: string;
  icon: React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function TabButton({ label, icon, isFocused, onPress, onLongPress }: TabButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    setPressed(false);
  };

  // Animation styles based on pressed state
  const animationStyle =
    Platform.OS === 'web'
      ? {
          transition: 'all 100ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: pressed ? 'scale(0.9)' : 'scale(1)',
          opacity: pressed ? 0.8 : 1,
          //filter: pressed ? 'brightness(1)' : 'brightness(1)',
        }
      : {
          opacity: pressed ? 0.4 : 1,
          transform: [{ scale: pressed ? 0.88 : 1 }],
        };

  // Transition style for active/inactive state change
  const activeTransitionStyle =
    Platform.OS === 'web'
      ? { transition: 'color 150ms ease-in-out, opacity 150ms ease-in-out' }
      : {};

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
    >
      {/* @ts-ignore - web CSS properties */}
      <View style={[styles.tabContent, animationStyle]}>
        {/* @ts-ignore - web CSS properties */}
        <View style={[styles.iconWrapper, activeTransitionStyle, { opacity: isFocused ? 1 : 0.5 }]}>
          {icon}
        </View>
        <Text
          // @ts-ignore - web CSS properties
          style={[
            styles.tabLabel,
            // @ts-ignore - web CSS transition property
            activeTransitionStyle,
            { color: isFocused ? 'white' : 'rgba(255, 255, 255, 0.5)' },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// Visible tabs - these are the main navigation tabs
const VISIBLE_TAB_NAMES = ['index', 'savings', 'card', 'activity'];

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  // Filter to only show the main visible tabs
  const visibleRoutes = state.routes.filter(route => VISIBLE_TAB_NAMES.includes(route.name));

  return (
    <View style={styles.tabBar}>
      {visibleRoutes.map(route => {
        const { options } = descriptors[route.key];
        const originalIndex = state.routes.findIndex(r => r.key === route.key);

        const label = options.title ?? route.name;
        const isFocused = state.index === originalIndex;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Get the icon
        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color: isFocused ? 'white' : 'rgba(255, 255, 255, 1)',
          size: 24,
        });

        return (
          <TabButton
            key={route.key}
            label={label}
            icon={icon}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 80,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // @ts-ignore - web CSS
    backdropFilter: 'blur(10px)',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 5,
  },
});
