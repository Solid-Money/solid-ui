import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ChartPayload } from '@/lib/types';

const CHART_HEIGHT = 160;
const PAD_TOP = 20;
const PAD_BOTTOM = 16;
const BRAND = '#94F27F';
const HANDLE = 34;

interface SimulateChartProps {
  data: ChartPayload[];
  /** Handle position (series index). */
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

type Point = { x: number; y: number };

const toPath = (points: Point[]) =>
  points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

/**
 * Cross-platform (react-native-svg) projection chart with a drag handle that
 * rides ALONG the curve. The solid line + area fill stop at the handle; the rest
 * of the curve is drawn faded. Dragging horizontally moves the handle (and the
 * parent's future-balance / earned readouts animate via CountUp).
 */
const SimulateChart = ({ data, activeIndex, onActiveIndexChange }: SimulateChartProps) => {
  const [width, setWidth] = useState(0);

  // Latest drag handler kept in a ref so the once-created PanResponder always
  // sees the current width / callback / series length.
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
    if (width <= 0 || data.length < 2) return [];
    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const usableH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
    return data.map((d, i) => ({
      x: (i / (data.length - 1)) * width,
      y: PAD_TOP + (1 - (d.value - min) / range) * usableH,
    }));
  }, [data, width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const clamped = Math.min(Math.max(activeIndex, 0), points.length - 1);
  const activePoints = points.slice(0, clamped + 1);
  const handlePoint = points[clamped];

  return (
    <View
      style={{ height: CHART_HEIGHT, width: '100%' }}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      {width > 0 && points.length > 1 && handlePoint && (
        <>
          <Svg width={width} height={CHART_HEIGHT} pointerEvents="none">
            <Defs>
              <LinearGradient id="simAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
                <Stop offset="100%" stopColor={BRAND} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {/* Full curve, faded — context beyond the handle. */}
            <Path
              d={toPath(points)}
              stroke={BRAND}
              strokeOpacity={0.22}
              strokeWidth={2}
              fill="none"
            />

            {/* Filled area up to the handle. */}
            {activePoints.length > 1 && (
              <Path
                d={`M ${activePoints[0].x} ${CHART_HEIGHT} ${activePoints
                  .map(p => `L ${p.x} ${p.y}`)
                  .join(' ')} L ${handlePoint.x} ${CHART_HEIGHT} Z`}
                fill="url(#simAreaGrad)"
              />
            )}

            {/* Solid line — stops at the handle. */}
            {activePoints.length > 1 && (
              <Path d={toPath(activePoints)} stroke={BRAND} strokeWidth={2.5} fill="none" />
            )}

            {/* Vertical guide dropping from the handle to the baseline. */}
            <Path
              d={`M ${handlePoint.x} ${handlePoint.y} L ${handlePoint.x} ${CHART_HEIGHT}`}
              stroke={BRAND}
              strokeOpacity={0.4}
              strokeWidth={2}
              fill="none"
            />
          </Svg>

          {/* Draggable handle riding the curve, with left/right chevron grips. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: handlePoint.x - HANDLE / 2,
              top: handlePoint.y - HANDLE / 2,
              width: HANDLE,
              height: HANDLE,
              borderRadius: HANDLE / 2,
              backgroundColor: BRAND,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={13} color="#0A0A0A" strokeWidth={2.5} />
            <ChevronRight size={13} color="#0A0A0A" strokeWidth={2.5} />
          </View>
        </>
      )}
    </View>
  );
};

export default SimulateChart;
