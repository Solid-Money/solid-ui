import { ActivityIndicator, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils/utils';

interface ShowDetailsButtonProps {
  /** Whether the card is currently flipped to reveal details. */
  isFlipped: boolean;
  isLoading: boolean;
  onPress: () => void;
  /**
   * When true, render as a "drawer" that peeks out from behind the card image
   * (top edge tucked under the card, only bottom corners rounded) — mirrors the
   * coins screen's "Earning yield" banner.
   */
  peek?: boolean;
  /** Hidden (opacity 0) while the card hero transition is running. */
  hidden?: boolean;
}

/**
 * "Show details" / "Hide details" button (lucide eye open/close), replacing the
 * small circular "Card details" action on the redesigned screen. In `peek` mode it
 * slides out from underneath the card image.
 */
const ShowDetailsButton = ({
  isFlipped,
  isLoading,
  onPress,
  peek = false,
  hidden = false,
}: ShowDetailsButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      className={cn(
        'flex-row items-center justify-center gap-2 bg-[#1C1C1C] transition-all active:scale-95 active:opacity-80',
        peek
          ? // Full width of the card (mx ≈ the card's shadow inset), tucked up
            // behind it so it reads as a drawer: flat top, rounded bottom. Pulled
            // up past the card's rounded bottom corners (so no gap shows at the
            // sides), with generous top padding to keep the icon/text in view.
            'mx-[5.5%] -mt-[38px] rounded-b-[28px] rounded-t-none px-6 pb-4 pt-[30px]'
          : 'mb-6 h-14 rounded-full',
        hidden && 'opacity-0',
      )}
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
