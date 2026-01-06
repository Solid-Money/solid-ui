import React from 'react';
import { GestureResponderEvent, Pressable, View } from 'react-native';

type SlotTriggerProps = {
  children: React.ReactNode;
  onPress: () => void;
};

// Components that don't support onPress and need Pressable wrapper
const NON_PRESSABLE_TYPES = [View];

/**
 * SlotTrigger - Wraps a trigger element and merges onPress handlers.
 *
 * This preserves hover/active styles on the child element by cloning it
 * and merging the onPress handler, rather than wrapping with a Pressable
 * that blocks pointer events.
 *
 * For non-pressable elements (like View), wraps in Pressable.
 */
const SlotTrigger = ({ children, onPress }: SlotTriggerProps) => {
  if (React.isValidElement<{ onPress?: (e: GestureResponderEvent) => void }>(children)) {
    // Check if it's a known non-pressable type
    const isNonPressable = NON_PRESSABLE_TYPES.some(type => children.type === type);

    if (isNonPressable) {
      return <Pressable onPress={onPress}>{children}</Pressable>;
    }

    // Clone and merge onPress for pressable elements
    const existingOnPress = children.props.onPress;
    return React.cloneElement(children, {
      onPress: (e: GestureResponderEvent) => {
        existingOnPress?.(e);
        onPress();
      },
    });
  }

  // Fallback for non-element children
  return <Pressable onPress={onPress}>{children}</Pressable>;
};

export default SlotTrigger;
