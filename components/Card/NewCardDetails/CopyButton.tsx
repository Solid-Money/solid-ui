import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';

import { CheckIcon, CopyIcon } from '@/components/Card/NewCardDetails/icons';

/** How long the tick stands in for the copy glyph after a successful copy. */
const COPIED_FEEDBACK_MS = 1600;

interface CopyButtonProps {
  onCopy: () => void;
  /** Announced before copying; the button announces "Copied" while showing the tick. */
  accessibilityLabel: string;
  /** Card ovals scale with the artwork, so their glyphs aren't the design size. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Copy affordance that turns into a tick for a moment once used. Both glyphs share a
 * box, so the swap reads as the icon changing rather than the control moving.
 */
const CopyButton = ({ onCopy, accessibilityLabel, size, style }: CopyButtonProps) => {
  const [hasCopied, setHasCopied] = useState(false);
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    };
  }, []);

  const handlePress = useCallback(() => {
    onCopy();
    setHasCopied(true);
    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => setHasCopied(false), COPIED_FEEDBACK_MS);
  }, [onCopy]);

  return (
    <Pressable
      accessibilityLabel={hasCopied ? 'Copied' : accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={handlePress}
      style={style}
      className="web:hover:opacity-70"
    >
      {hasCopied ? <CheckIcon size={size} /> : <CopyIcon size={size} />}
    </Pressable>
  );
};

export default CopyButton;
