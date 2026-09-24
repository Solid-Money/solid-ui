import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';

/** The desktop modal's back and close buttons: one size, so they read as a pair in one row. */
export const MODAL_CONTROL_SIZE = 36;

interface SheetIconButtonProps {
  icon: 'back' | 'close';
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Diameter. The bottom sheet's back button is 40; the modal's controls are 36. */
  size?: number;
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
  size = MODAL_CONTROL_SIZE,
  style,
}: SheetIconButtonProps) => {
  // 22 in the 40pt back button is what the bottom sheet has always drawn; the rest scale
  // with it. The cross is drawn smaller than the chevron because it fills more of its box.
  const glyph = Math.round(size * (icon === 'back' ? 0.55 : 0.45));

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
          borderRadius: size / 2,
          height: size,
          justifyContent: 'center',
          width: size,
        },
        style,
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
