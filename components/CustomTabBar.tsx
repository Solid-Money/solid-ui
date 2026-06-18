import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import TabBarBackground from '@/components/ui/TabBarBackground';
import { Text } from '@/components/ui/text';

// Height of the visible content zone (icons + labels + top padding) that sits
// above the bottom safe-area inset. Combined with the dynamic bottom inset this
// reproduces the original height of 80 (45 + 35) on devices without a large
// system bar, while keeping the icon/label band a constant size everywhere.
const TAB_BAR_CONTENT_HEIGHT = 45;
// Baseline bottom spacing. Matches the previously hardcoded paddingBottom so
// devices whose safe-area inset is smaller — notched iOS (~34), gesture-nav
// Android (~16-24) and web (0) — keep their exact current layout. Only devices
// with a larger inset (e.g. Android 3-button navigation, ~48) get extra spacing
// so the tab bar clears the system navigation bar instead of overlapping it.
const TAB_BAR_MIN_BOTTOM_INSET = 35;
// Extra clearance added on top of the *real* inset on Android only. Android
// system navigation bars sit flush with the bottom inset, and the icon+label
// content slightly overflows the visible band, so on devices with a tall
// navigation bar (3-button nav) the label can still touch it. Added to the real
// inset (not the floor) so gesture-nav devices barely change; iOS (thin home
// indicator) and web have no such overlap and are deliberately excluded.
const TAB_BAR_ANDROID_EXTRA_INSET = 16;

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
      <View style={[styles.tabContent, animationStyle as ViewStyle]}>
        <View
          style={[
            styles.iconWrapper,
            (Platform.OS === 'web' ? { transition: 'opacity 150ms ease-in-out' } : {}) as ViewStyle,
            Platform.OS === 'web' ? { opacity: isFocused ? 1 : 0.5 } : {},
          ]}
        >
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
  const insets = useSafeAreaInsets();

  // Lift the tab bar above the system navigation bar / home indicator using the
  // real bottom inset (plus a little extra on Android, see constant), never
  // shrinking below the legacy baseline. Read-only — this does not alter the
  // inset context, so other components (ResponsiveModal, SafeAreaView,
  // ScrollViews) are unaffected.
  const bottomInset = Math.max(
    insets.bottom + (Platform.OS === 'android' ? TAB_BAR_ANDROID_EXTRA_INSET : 0),
    TAB_BAR_MIN_BOTTOM_INSET,
  );

  // Filter to only show the main visible tabs
  const visibleRoutes = state.routes.filter(route => VISIBLE_TAB_NAMES.includes(route.name));

  return (
    <View
      style={[
        styles.tabBar,
        { height: TAB_BAR_CONTENT_HEIGHT + bottomInset, paddingBottom: bottomInset },
      ]}
    >
      {TabBarBackground && <TabBarBackground />}
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
    // height and paddingBottom are applied dynamically from the safe-area inset
    paddingTop: 10,
    backgroundColor: Platform.OS === 'web' ? 'rgba(18, 18, 18, 0.7)' : 'transparent',
    borderTopWidth: 0,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    // @ts-ignore - web CSS
    backdropFilter: Platform.OS === 'web' ? 'blur(10px)' : undefined,
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
    marginTop: -2,
  },
});
