import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from '@/components/ui/text';

interface TeammateAvatarProps {
  /** The agent's display name ("Eli"); its first letter is shown. */
  name: string | null | undefined;
  size?: number;
  /** The green "online" dot: the teammate is in the conversation right now. */
  online?: boolean;
}

/** A Solid teammate: their initial on the team gradient (Figma "Avatar / Teammate"). */
function TeammateAvatar({ name, size = 28, online = false }: TeammateAvatarProps) {
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || 'S';
  const dot = Math.max(8, size * 0.3);
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel={`${name?.trim() || 'Solid team'}, Solid team`}
    >
      <LinearGradient
        colors={['#C3A6FF', '#6F7FF2']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.face, { borderRadius: size / 2 }]}
      >
        <Text
          className="font-semibold text-white"
          style={{ fontSize: size * 0.42, lineHeight: size * 0.5 }}
        >
          {initial}
        </Text>
      </LinearGradient>
      {online && (
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              right: -dot * 0.1,
              bottom: -dot * 0.1,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    backgroundColor: '#94F27F',
    borderWidth: 2,
    borderColor: '#111111',
  },
});

export default memo(TeammateAvatar);
