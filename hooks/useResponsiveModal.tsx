import { useCallback, isValidElement } from "react";
import { View } from "react-native";

import { useDimension } from "./useDimension";

const useResponsiveModal = () => {
  const { isScreenMedium } = useDimension();

  const triggerElement = useCallback((trigger: React.ReactNode, className = 'flex-1') => {
    if (isScreenMedium || !isValidElement(trigger)) {
      return trigger;
    }

    // Wrap trigger in View with pointerEvents="none"
    // This ensures touch events are properly captured on mobile
    // We disable pointer events on the child to let the parent Pressable handle them
    return <View pointerEvents="none" className={className}>{trigger}</View>;
  }, [isScreenMedium]);

  return {
    triggerElement,
  };
};

export default useResponsiveModal;
