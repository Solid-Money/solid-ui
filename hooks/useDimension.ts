import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

const SCREEN_MEDIUM_WIDTH = 768;

export const useDimension = () => {
  const { width } = useWindowDimensions();

  const isScreenMedium = useMemo(() => {
    return (width || 0) >= SCREEN_MEDIUM_WIDTH;
  }, [width]);

  const isDesktop = useMemo(() => {
    if (Platform.OS !== 'web') return false;
    return isScreenMedium;
  }, [isScreenMedium]);

  return { isDesktop, isScreenMedium };
};
