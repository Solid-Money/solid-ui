import { ActivityIndicator, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface ShowDetailsButtonProps {
  /** Whether the card is currently flipped to reveal details. */
  isFlipped: boolean;
  isLoading: boolean;
  onPress: () => void;
}

/**
 * Full-row "Show details" / "Hide details" button (lucide eye open/close),
 * replacing the small circular "Card details" action for whitelisted users.
 */
const ShowDetailsButton = ({ isFlipped, isLoading, onPress }: ShowDetailsButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className="mb-6 h-14 flex-row items-center justify-center gap-2 rounded-full bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="white" />
      ) : isFlipped ? (
        <EyeOff size={20} color="white" />
      ) : (
        <Eye size={20} color="white" />
      )}
      <Text className="text-base font-bold text-white">
        {isFlipped ? 'Hide details' : 'Show details'}
      </Text>
    </Pressable>
  );
};

export default ShowDetailsButton;
