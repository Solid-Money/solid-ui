import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';

import { CIRCULAR_CONTROL_SIZE, CIRCULAR_CONTROL_STYLE } from '@/components/ui/circular-control';

/** Sheet and modal controls share the app's header-button diameter. */
export const MODAL_CONTROL_SIZE = CIRCULAR_CONTROL_SIZE;

interface SheetIconButtonProps {
  icon: 'back' | 'close';
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Placement, which is the caller's — usually absolute within a header row. */
  style?: StyleProp<ViewStyle>;
}

/**
 * The round #2B2B2B icon button the card sheets use for back and close — the same surface as
 * their cards, so a control reads as part of the sheet rather than as page chrome.
 */
const SheetIconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  style,
}: SheetIconButtonProps) => {
  const glyph = icon === 'back' ? 22 : 18;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className="transition-all active:scale-95 active:opacity-80 web:hover:opacity-80"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={[
        {
          alignItems: 'center',
          backgroundColor: '#2B2B2B',
          justifyContent: 'center',
        },
        style,
        CIRCULAR_CONTROL_STYLE,
      ]}
    >
      {icon === 'back' ? (
        <ChevronLeft color="#FFFFFF" size={glyph} />
      ) : (
        <X color="#FFFFFF" size={glyph} />
      )}
    </Pressable>
  );
};

export default SheetIconButton;
