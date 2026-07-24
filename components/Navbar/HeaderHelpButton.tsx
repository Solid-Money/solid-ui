import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';

interface HeaderHelpButtonProps {
  onPress: () => void;
}

/**
 * Circular "?" button shown in the top-right of the redesigned mobile header,
 * on the Savings screen only. Opens the "How savings works" help carousel.
 * Styling matches HeaderBellButton / WhatsNewButton.
 */
const HeaderHelpButton = ({ onPress }: HeaderHelpButtonProps) => {
  return (
    <Pressable
      accessibilityLabel="How savings works"
      accessibilityRole="button"
      onPress={onPress}
      className="h-9 w-9 items-center justify-center rounded-full bg-[#2A2A2A] transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <Text className="text-lg font-medium text-white">?</Text>
    </Pressable>
  );
};

export default HeaderHelpButton;
