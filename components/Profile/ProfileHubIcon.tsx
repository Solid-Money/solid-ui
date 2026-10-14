import { View } from 'react-native';
import { Image } from 'expo-image';

// Cropped glyphs exported from the settings hub in Figma. Keep their original
// proportions inside the icon slot; most were authored in a 24px icon frame.
const ICONS = {
  'key-round': {
    source: require('@/assets/images/profile-hub/key-round.svg'),
    width: 21.7882,
    height: 21.7882,
    frame: 24,
  },
  lock: {
    source: require('@/assets/images/profile-hub/lock.svg'),
    width: 19.75,
    height: 21.75,
    frame: 24,
  },
  mail: {
    source: require('@/assets/images/profile-hub/mail.svg'),
    width: 21.7502,
    height: 17.75,
    frame: 24,
  },
  'chevron-right': {
    source: require('@/assets/images/profile-hub/chevron-right.svg'),
    width: 7.75,
    height: 13.75,
    frame: 24,
  },
  'file-text': {
    source: require('@/assets/images/profile-hub/file-text.svg'),
    width: 17.75,
    height: 21.75,
    frame: 24,
  },
  'life-buoy': {
    source: require('@/assets/images/profile-hub/life-buoy.svg'),
    width: 21.75,
    height: 21.75,
    frame: 24,
  },
  bell: {
    source: require('@/assets/images/profile-hub/bell.svg'),
    width: 19.7496,
    height: 21.7499,
    frame: 24,
  },
  'shield-check': {
    source: require('@/assets/images/profile-hub/shield-check.svg'),
    width: 17.75,
    height: 21.7534,
    frame: 24,
  },
  'file-down': {
    source: require('@/assets/images/profile-hub/file-down.svg'),
    width: 17.75,
    height: 21.75,
    frame: 24,
  },
  'credit-card': {
    source: require('@/assets/images/profile-hub/credit-card.svg'),
    width: 21.75,
    height: 15.75,
    frame: 24,
  },
  'user-round': {
    source: require('@/assets/images/profile-hub/user-round.svg'),
    width: 17.75,
    height: 19.75,
    frame: 24,
  },
  'badge-check': {
    source: require('@/assets/images/profile-hub/badge-check.svg'),
    width: 21.7561,
    height: 21.7483,
    frame: 24,
  },
  'arrow-left': {
    source: require('@/assets/images/profile-hub/arrow-left.svg'),
    width: 15.75,
    height: 15.75,
    frame: 24,
  },
  pencil: {
    source: require('@/assets/images/profile-hub/pencil.svg'),
    width: 13.4166,
    height: 13.4164,
    frame: 14,
  },
  sparkle: {
    source: require('@/assets/images/profile-hub/sparkle.svg'),
    width: 12.6695,
    height: 12.6695,
    frame: 14,
  },
  'users-round': {
    source: require('@/assets/images/profile-hub/users-round.svg'),
    width: 18.4167,
    height: 16.75,
    frame: 20,
  },
  'log-out': {
    source: require('@/assets/images/profile-hub/log-out.svg'),
    width: 16.75,
    height: 16.75,
    frame: 20,
  },
};

export default function ProfileHubIcon({
  name,
  size = 20,
}: {
  name: keyof typeof ICONS;
  size?: number;
}) {
  const icon = ICONS[name];
  const scale = size / icon.frame;

  return (
    <View
      accessible={false}
      className="items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Image
        source={icon.source}
        contentFit="contain"
        style={{ width: icon.width * scale, height: icon.height * scale }}
      />
    </View>
  );
}
