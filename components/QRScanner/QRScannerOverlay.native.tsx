/**
 * QRScannerOverlay Component
 *
 * Visual overlay for the QR scanner with:
 * - Semi-transparent darkened regions around the scan area
 * - Animated corner markers in Solid brand color
 * - Scan line animation (optional)
 */

import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface QRScannerOverlayProps {
  /** Size of the scan area (default: 280) */
  scanAreaSize?: number;
  /** Whether to show the scan line animation */
  showScanLine?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const DEFAULT_SCAN_AREA_SIZE = 280;
const CORNER_SIZE = 40;
const CORNER_THICKNESS = 4;
const CORNER_RADIUS = 8;

const QRScannerOverlay: React.FC<QRScannerOverlayProps> = ({
  scanAreaSize = DEFAULT_SCAN_AREA_SIZE,
  showScanLine = true,
}) => {
  // Animation for corner pulse effect
  const cornerOpacity = useSharedValue(1);

  // Animation for scan line
  const scanLinePosition = useSharedValue(0);

  useEffect(() => {
    // Subtle corner pulse animation
    cornerOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );

    // Scan line animation
    if (showScanLine) {
      scanLinePosition.value = withRepeat(
        withSequence(
          withTiming(scanAreaSize - 4, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }
  }, [cornerOpacity, scanLinePosition, scanAreaSize, showScanLine]);

  const cornerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cornerOpacity.value,
  }));

  const scanLineAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value }],
  }));

  // Calculate the vertical offset to center the scan area
  const verticalOffset = (SCREEN_HEIGHT - scanAreaSize) / 2;
  const horizontalOffset = (SCREEN_WIDTH - scanAreaSize) / 2;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* Top overlay */}
      <View style={[styles.overlay, { height: verticalOffset }]} />

      {/* Middle row */}
      <View style={styles.middleRow}>
        {/* Left overlay */}
        <View style={[styles.overlay, { width: horizontalOffset }]} />

        {/* Scan area (transparent) */}
        <View style={[styles.scanArea, { width: scanAreaSize, height: scanAreaSize }]}>
          {/* Corner markers */}
          <Animated.View style={[styles.corner, styles.topLeft, cornerAnimatedStyle]} />
          <Animated.View style={[styles.corner, styles.topRight, cornerAnimatedStyle]} />
          <Animated.View style={[styles.corner, styles.bottomLeft, cornerAnimatedStyle]} />
          <Animated.View style={[styles.corner, styles.bottomRight, cornerAnimatedStyle]} />

          {/* Scan line */}
          {showScanLine && <Animated.View style={[styles.scanLine, scanLineAnimatedStyle]} />}
        </View>

        {/* Right overlay */}
        <View style={[styles.overlay, { width: horizontalOffset }]} />
      </View>

      {/* Bottom overlay */}
      <View style={[styles.overlay, { height: verticalOffset }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
  },
  scanArea: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#94F27F',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: CORNER_RADIUS,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: CORNER_RADIUS,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: CORNER_RADIUS,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: CORNER_RADIUS,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#94F27F',
    opacity: 0.5,
    borderRadius: 1,
  },
});

export default QRScannerOverlay;
