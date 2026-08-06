import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { EyeIcon, EyeOffIcon } from '@/components/Card/NewCardDetails/icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils/utils';

interface ShowDetailsButtonProps {
  /** Whether the card is currently flipped to reveal details. */
  isFlipped: boolean;
  isLoading: boolean;
  onPress: () => void;
  /**
   * When true, render as the design's panel: a #1C1C1C rounded rectangle whose top
   * (and top radius) is tucked behind the card, so only a strip carrying the eye +
   * label shows below it (Figma 20095:5545).
   */
  peek?: boolean;
}

/**
 * "Show details" / "Hide details" control. In `peek` mode it is the panel sitting
 * behind the card on the redesigned card-details screen; otherwise a plain pill.
 */
const ShowDetailsButton = ({
  isFlipped,
  isLoading,
  onPress,
  peek = false,
}: ShowDetailsButtonProps) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={isLoading}
      style={peek ? styles.panel : undefined}
      className={cn(
        'flex-row items-center justify-center gap-[5px] bg-card transition-all',
        peek ? 'rounded-[23px]' : 'mb-6 h-14 rounded-full active:scale-95 active:opacity-80',
      )}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="white" />
      ) : peek ? (
        isFlipped ? (
          <EyeOffIcon />
        ) : (
          <EyeIcon />
        )
      ) : isFlipped ? (
        <EyeOff size={20} color="white" />
      ) : (
        <Eye size={20} color="white" />
      )}
      <Text className="text-[16px] font-medium text-white">
        {isFlipped ? 'Hide details' : 'Show details'}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  // RN resolves percentage margins/paddings against the parent's WIDTH, so these
  // keep the design's proportions (measured on a 419pt frame) at any screen size:
  //   marginHorizontal  21/419 → 2pt wider than the card body on each side
  //   marginTop        -71/419 → pulls the top, and its radius, behind the card
  //   paddingTop       100/419 → the hidden part; puts the row 103 from the top
  //   paddingBottom     30/419 → centres the row in the 83pt strip below the card
  panel: {
    marginHorizontal: '5%',
    marginTop: '-16.95%',
    paddingBottom: '7.16%',
    paddingTop: '23.87%',
  },
});

export default ShowDetailsButton;
