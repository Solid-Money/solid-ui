import { ReactNode, useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';

import { useCardHeroStore } from '@/store/useCardHeroStore';

/**
 * Wraps the card on the card-details screen. Reports its resting window rect to
 * the hero store (so <CardHeroOverlay/> knows where to fly the card to) and hides
 * the real card while the flight is in progress, so only the flying clone is
 * visible — then reveals it once the transition ends. A no-op visual wrapper when
 * no transition is active (direct navigation).
 */
const CardHeroTarget = ({ children }: { children: ReactNode }) => {
  const active = useCardHeroStore(state => state.active);
  const setToRect = useCardHeroStore(state => state.setToRect);
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    // measureInWindow gives screen coordinates matching the overlay's frame.
    // A rAF ensures layout has settled before we read it.
    requestAnimationFrame(() => {
      node.measureInWindow((x, y, width, height) => {
        if (width && height) setToRect({ x, y, width, height });
      });
    });
  }, [setToRect]);

  // Also re-measure if a transition becomes active after mount.
  useEffect(() => {
    if (active) measure();
  }, [active, measure]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={measure}
      style={active ? { opacity: 0 } : undefined}
    >
      {children}
    </View>
  );
};

export default CardHeroTarget;
