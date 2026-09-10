import { useEffect, useState } from 'react';

// Covers the longest section exit (600ms) and the card's return flight (620ms).
export const CLOSE_SETTLE_MS = 640;

export function useCardPaneVisibility(isOpen: boolean) {
  const [isRetained, setIsRetained] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      // Arm the exit hold while open, before a close can commit. Enabling it in
      // the close effect would briefly hide the pane and then show it again.
      setIsRetained(true);
      return;
    }
    const timer = setTimeout(() => setIsRetained(false), CLOSE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return isOpen || isRetained;
}
