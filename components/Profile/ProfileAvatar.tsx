import { View } from 'react-native';

import { Text } from '@/components/ui/text';

import { AvatarColorId, getAvatarColor, getAvatarInitial } from './avatarColors';

interface ProfileAvatarProps {
  name: string | null | undefined;
  colorId?: AvatarColorId | null;
  size: number;
}

/** The account's initial on a tinted disc. */
const ProfileAvatar = ({ name, colorId, size }: ProfileAvatarProps) => {
  const color = getAvatarColor(colorId);

  return (
    <View
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: color.bg }}
    >
      <Text
        className="font-semibold"
        style={{ color: color.text, fontSize: Math.round(size * 0.4), lineHeight: size * 0.5 }}
      >
        {getAvatarInitial(name)}
      </Text>
    </View>
  );
};

export default ProfileAvatar;
