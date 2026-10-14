import { View } from 'react-native';

import GlassCircleBackground from '@/components/ui/glass-circle-background';
import { Text } from '@/components/ui/text';

import { AvatarColorId, getAvatarColor, getAvatarInitial } from './avatarColors';

interface ProfileAvatarProps {
  name: string | null | undefined;
  colorId?: AvatarColorId | null;
  size: number;
  variant?: 'default' | 'hub' | 'header';
}

/** The account's initial, with the same radial-gradient glass styling in the hub and header. */
const ProfileAvatar = ({ name, colorId, size, variant = 'default' }: ProfileAvatarProps) => {
  const color = getAvatarColor(colorId);
  const isMonochrome = variant === 'hub' || variant === 'header';

  return (
    <View
      className="items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: isMonochrome ? undefined : color.bg }}
    >
      {isMonochrome ? (
        <GlassCircleBackground size={size} backgroundOpacity={variant === 'header' ? 0.8 : 1} />
      ) : null}
      <Text
        className={isMonochrome ? 'font-light' : 'font-semibold'}
        style={{
          color: isMonochrome ? '#FFFFFF' : color.text,
          fontSize: isMonochrome ? size * 0.4 : Math.round(size * 0.4),
          lineHeight: size * 0.5,
        }}
      >
        {getAvatarInitial(name)}
      </Text>
    </View>
  );
};

export default ProfileAvatar;
