import { useCallback, isValidElement } from "react";
import { View } from "react-native";

import { useDimension } from "./useDimension";

const useResponsiveModal = () => {
  const { isScreenMedium } = useDimension();

  const triggerElement = useCallback((trigger: React.ReactNode) => {
    if (isScreenMedium || !isValidElement(trigger)) {
      return trigger;
    }

    // Wrap trigger in Pressable
    // This ensures touch events are properly captured on mobile
    // We disable pointer events on the child to let the parent Pressable handle them
    return <View pointerEvents="none">{trigger}</View>;
  }, [isScreenMedium]);

  return {
    triggerElement,
  };
};

export default useResponsiveModal;
