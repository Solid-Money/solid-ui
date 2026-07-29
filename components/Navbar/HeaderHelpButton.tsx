import { Pressable } from 'react-native';

import HeaderHelpIcon from '@/assets/images/header-help';

interface HeaderHelpButtonProps {
  onPress: () => void;
}

/**
 * Circular "?" button shown in the top-right of the redesigned mobile header,
 * opening the contextual help carousel for the current screen.
 */
const HeaderHelpButton = ({ onPress }: HeaderHelpButtonProps) => {
  return (
    <Pressable
      accessibilityLabel="How savings works"
      accessibilityRole="button"
      onPress={onPress}
      className="-my-[3px] h-[50px] w-[50px] items-center justify-center rounded-full transition-all active:scale-95 active:opacity-80"
    >
      <HeaderHelpIcon />
    </Pressable>
  );
};

export default HeaderHelpButton;
