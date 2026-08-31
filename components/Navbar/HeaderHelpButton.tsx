import { Pressable } from 'react-native';

import HeaderHelpIcon from '@/assets/images/header-help';

interface HeaderHelpButtonProps {
  onPress: () => void;
  accessibilityLabel?: string;
  variant?: 'default' | 'hero';
}

/**
 * Circular "?" button shown in the top-right of the redesigned mobile header,
 * opening the contextual help carousel for the current screen.
 */
const HeaderHelpButton = ({
  onPress,
  accessibilityLabel = 'Open help',
  variant = 'default',
}: HeaderHelpButtonProps) => {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80"
    >
      <HeaderHelpIcon backgroundColor={variant === 'hero' ? '#111111' : undefined} />
    </Pressable>
  );
};

export default HeaderHelpButton;
