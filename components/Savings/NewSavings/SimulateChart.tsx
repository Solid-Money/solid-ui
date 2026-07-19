import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Image } from 'expo-image';

import { getAsset } from '@/lib/assets';
import { ChartPayload } from '@/lib/types';

const BRAND = '#94F27F';
const GRAY = '#9CA3AF';
const HANDLE = 34;
const PAD_TOP = 22;
const PAD_BOTTOM = 10;

interface SimulateChartProps {
  data: ChartPayload[];
  /** Handle position (series index). */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

type Point = { x: number; y: number };

/** Catmull-Rom → cubic-bezier smoothing for a curvier line. */
const smoothPath = (pts: Point[]) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
};

/** Closed area under a smoothed segment, down to the baseline. */
const areaPath = (pts: Point[], baseline: number) => {
  if (pts.length < 2) return '';
  return `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`;
};

/**
 * Cross-platform (react-native-svg) projection chart. Fills its parent so the
 * card can overlay the future-balance text on top-left. The handle rides ALONG
 * the (smoothed) curve; the left of the handle gets a green gradient fill, the
 * right a gray gradient. Dragging horizontally moves the handle.
 */
const SimulateChart = ({ data, activeIndex, onActiveIndexChange }: SimulateChartProps) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w: width, h: height } = size;

  // Latest drag handler in a ref so the once-created PanResponder always sees the
  // current width / callback / series length.
  const updateRef = useRef<(x: number) => void>(() => {});
  updateRef.current = (x: number) => {
    if (width <= 0 || data.length < 2) return;
    const ratio = Math.min(Math.max(x / width, 0), 1);
    onActiveIndexChange(Math.round(ratio * (data.length - 1)));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        // Only claim horizontal drags so vertical page scroll still works.
        onMoveShouldSetPanResponder: (_e, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: e => updateRef.current(e.nativeEvent.locationX),
        onPanResponderMove: e => updateRef.current(e.nativeEvent.locationX),
      }),
    [],
  );

  const points = useMemo<Point[]>(() => {
    if (width <= 0 || height <= 0 || data.length < 2) return [];
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const usableH = height - PAD_TOP - PAD_BOTTOM;
    return data.map((d, i) => ({
      x: (i / (data.length - 1)) * width,
      y: PAD_TOP + (1 - (d.value - min) / range) * usableH,
    }));
  }, [data, width, height]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSize(prev => (prev.w === w && prev.h === h ? prev : { w, h }));
  };

  const clamped = Math.min(Math.max(activeIndex, 0), points.length - 1);
  const leftPts = points.slice(0, clamped + 1);
  const rightPts = points.slice(clamped);
  const handlePoint = points[clamped];

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} {...panResponder.panHandlers}>
      {width > 0 && height > 0 && points.length > 1 && handlePoint && (
        <>
          <Svg width={width} height={height} pointerEvents="none">
            <Defs>
              <LinearGradient id="simGreen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={BRAND} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="simGray" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={GRAY} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={GRAY} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Gray area to the right of the handle. */}
            {rightPts.length > 1 && <Path d={areaPath(rightPts, height)} fill="url(#simGray)" />}
            {/* Green area to the left (up to the handle). */}
            {leftPts.length > 1 && <Path d={areaPath(leftPts, height)} fill="url(#simGreen)" />}

            {/* Full curve, faded. */}
            <Path
              d={smoothPath(points)}
              stroke={BRAND}
              strokeOpacity={0.25}
              strokeWidth={2}
              fill="none"
            />
            {/* Solid line up to the handle. */}
            {leftPts.length > 1 && (
              <Path d={smoothPath(leftPts)} stroke={BRAND} strokeWidth={2.5} fill="none" />
            )}

            {/* Vertical guide dropping from the handle to the baseline. */}
            <Path
              d={`M ${handlePoint.x} ${handlePoint.y} L ${handlePoint.x} ${height}`}
              stroke={BRAND}
              strokeOpacity={0.4}
              strokeWidth={2}
              fill="none"
            />
          </Svg>

          {/* Draggable handle riding the curve, with left/right chevron grips. */}
          <View
            pointerEvents="none"
            style={[
              styles.handle,
              { left: handlePoint.x - HANDLE / 2, top: handlePoint.y - HANDLE / 2 },
            ]}
          >
            <Image
              source={getAsset('images/left-chevron.png')}
              style={styles.chevron}
              contentFit="contain"
            />
            <Image
              source={getAsset('images/right-chevron.png')}
              style={styles.chevron}
              contentFit="contain"
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    borderRadius: HANDLE / 2,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    // Figma: box-shadow 0 0 20px #000000CC.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
  },
  chevron: {
    width: 7,
    height: 12,
  },
});

export default SimulateChart;
