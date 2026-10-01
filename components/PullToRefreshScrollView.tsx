import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

export const REFRESH_SPINNER_COLOR = '#8E8E93';
const REFRESH_DISTANCE = 64;
const MAX_PULL_DISTANCE = 120;
const PULL_RESISTANCE = 0.45;
const TOUCH_SLOP = 8;
const SPINNER_SIZE = 20;
const SPINNER_CONTAINER_SIZE = 36;
const SPINNER_RADIUS = 8;
const SPINNER_CIRCUMFERENCE = 2 * Math.PI * SPINNER_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = ScrollViewProps & {
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshIndicatorOffset?: number;
};

/** Android's standard refresh control leaves the content stationary. Move the
 * scroll view with the finger instead; iOS keeps its native bounce and spinner. */
const AndroidRefreshScrollView = forwardRef<ScrollView, Props>(function AndroidRefreshScrollView(
  {
    onRefresh,
    refreshing = false,
    refreshIndicatorOffset = 0,
    refreshControl: _refreshControl,
    style,
    scrollEnabled = true,
    ...props
  },
  ref,
) {
  const scrollRef = useAnimatedRef<ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  const pullDistance = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const isDragging = useSharedValue(false);
  const refreshInFlight = useSharedValue(refreshing);
  const spinRotation = useSharedValue(0);
  const awaitingRefresh = useRef(false);
  const refreshingRef = useRef(refreshing);
  refreshingRef.current = refreshing;

  // FlashList and scroll-to-top callers need the actual scroll view's methods.
  useImperativeHandle(ref, () => scrollRef.current!, [scrollRef]);

  useEffect(() => {
    refreshInFlight.value = refreshing || awaitingRefresh.current;
    if (refreshing) {
      pullDistance.value = withTiming(REFRESH_DISTANCE, { duration: 180 });
    } else if (!awaitingRefresh.current) {
      pullDistance.value = withTiming(0, { duration: 220 });
    }
  }, [pullDistance, refreshInFlight, refreshing]);

  const requestRefresh = useCallback(async () => {
    if (!onRefresh || awaitingRefresh.current || refreshingRef.current) return;
    awaitingRefresh.current = true;
    try {
      await onRefresh();
    } finally {
      awaitingRefresh.current = false;
      refreshInFlight.value = refreshingRef.current;
      if (!refreshingRef.current) {
        pullDistance.value = withTiming(0, { duration: 220 });
      }
    }
  }, [onRefresh, pullDistance, refreshInFlight]);

  const nativeScrollGesture = Gesture.Native().enabled(scrollEnabled);
  const pullGesture = Gesture.Pan()
    .enabled(scrollEnabled)
    .maxPointers(1)
    .manualActivation(true)
    .simultaneousWithExternalGesture(nativeScrollGesture)
    .onTouchesDown((event, manager) => {
      if (refreshInFlight.value || scrollOffset.value > 0 || event.numberOfTouches !== 1) {
        manager.fail();
        return;
      }
      const touch = event.allTouches[0];
      startX.value = touch.absoluteX;
      startY.value = touch.absoluteY;
    })
    .onTouchesMove((event, manager) => {
      if (isDragging.value) return;
      if (refreshInFlight.value || scrollOffset.value > 0 || event.numberOfTouches !== 1) {
        manager.fail();
        return;
      }
      const touch = event.allTouches[0];
      const dx = touch.absoluteX - startX.value;
      const dy = touch.absoluteY - startY.value;
      // Give upward scrolling and horizontal card/filter swipes to their owners.
      if (dy < -TOUCH_SLOP || (Math.abs(dx) > TOUCH_SLOP && Math.abs(dx) > Math.abs(dy))) {
        manager.fail();
      } else if (dy > TOUCH_SLOP) {
        manager.activate();
      }
    })
    .onStart(() => {
      cancelAnimation(pullDistance);
      isDragging.value = true;
    })
    .onUpdate(event => {
      // Absolute coordinates stay stable while the view itself moves.
      pullDistance.value = Math.min(
        MAX_PULL_DISTANCE,
        Math.max(0, (event.absoluteY - startY.value) * PULL_RESISTANCE),
      );
    })
    .onEnd((_event, success) => {
      if (success && pullDistance.value >= REFRESH_DISTANCE && !refreshInFlight.value) {
        refreshInFlight.value = true;
        pullDistance.value = withTiming(REFRESH_DISTANCE, { duration: 180 });
        scheduleOnRN(requestRefresh);
      }
    })
    .onFinalize(() => {
      isDragging.value = false;
      if (!refreshInFlight.value) {
        pullDistance.value = withTiming(0, { duration: 220 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pullDistance.value }],
  }));
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pullDistance.value / 24),
    transform: [{ translateY: Math.max(0, (pullDistance.value - SPINNER_CONTAINER_SIZE) / 2) }],
  }));

  // Pulling fills and turns the arc with the finger. Only a committed refresh
  // runs a repeating animation; holding a short pull leaves the arc stationary.
  useAnimatedReaction(
    () => refreshInFlight.value,
    (inFlight, previous) => {
      if (inFlight === previous) return;
      cancelAnimation(spinRotation);
      spinRotation.value = 0;
      if (inFlight) {
        spinRotation.value = withRepeat(
          withTiming(360, { duration: 900, easing: Easing.linear }),
          -1,
          false,
        );
      }
    },
  );
  const progressProps = useAnimatedProps(() => {
    const progress = refreshInFlight.value ? 1 : Math.min(1, pullDistance.value / REFRESH_DISTANCE);
    return { strokeDashoffset: SPINNER_CIRCUMFERENCE * (1 - progress * 0.75) };
  });
  const rotationStyle = useAnimatedStyle(() => {
    const progress = refreshInFlight.value ? 1 : Math.min(1, pullDistance.value / REFRESH_DISTANCE);
    return { transform: [{ rotate: `${progress * 180 + spinRotation.value}deg` }] };
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.spinner, { top: refreshIndicatorOffset }, spinnerStyle]}
        accessibilityElementsHidden={!refreshing}
        importantForAccessibility={refreshing ? 'auto' : 'no-hide-descendants'}
      >
        <View style={styles.spinnerCircle}>
          <Animated.View
            style={rotationStyle}
            accessible={refreshing}
            accessibilityRole="progressbar"
            accessibilityLabel="Refreshing content"
          >
            <Svg width={SPINNER_SIZE} height={SPINNER_SIZE}>
              <AnimatedCircle
                animatedProps={progressProps}
                cx={SPINNER_SIZE / 2}
                cy={SPINNER_SIZE / 2}
                r={SPINNER_RADIUS}
                fill="none"
                stroke={REFRESH_SPINNER_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray={[SPINNER_CIRCUMFERENCE, SPINNER_CIRCUMFERENCE]}
                rotation={-90}
                originX={SPINNER_SIZE / 2}
                originY={SPINNER_SIZE / 2}
              />
            </Svg>
          </Animated.View>
        </View>
      </Animated.View>
      <GestureDetector gesture={pullGesture}>
        <Animated.View style={[styles.container, contentStyle]}>
          <GestureDetector gesture={nativeScrollGesture}>
            <Animated.ScrollView
              {...props}
              ref={scrollRef}
              style={styles.scrollView}
              scrollEnabled={scrollEnabled}
              scrollEventThrottle={16}
              overScrollMode="never"
            />
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

const PullToRefreshScrollView = forwardRef<ScrollView, Props>(function PullToRefreshScrollView(
  { onRefresh, refreshing, refreshIndicatorOffset, refreshControl, ...props },
  ref,
) {
  // FlashList passes refresh callbacks through its RefreshControl element.
  const refresh = onRefresh ?? refreshControl?.props.onRefresh;
  const isRefreshing = refreshing ?? refreshControl?.props.refreshing ?? false;
  const indicatorOffset = refreshIndicatorOffset ?? refreshControl?.props.progressViewOffset ?? 0;

  if (Platform.OS === 'android' && refresh) {
    return (
      <AndroidRefreshScrollView
        {...props}
        ref={ref}
        onRefresh={refresh}
        refreshing={isRefreshing}
        refreshIndicatorOffset={indicatorOffset}
      />
    );
  }

  return (
    <ScrollView
      {...props}
      ref={ref}
      alwaysBounceVertical={refresh ? true : props.alwaysBounceVertical}
      refreshControl={
        Platform.OS === 'ios' && refresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={REFRESH_SPINNER_COLOR}
            progressViewOffset={indicatorOffset}
          />
        ) : (
          refreshControl
        )
      }
    />
  );
});

export default PullToRefreshScrollView;

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  scrollView: { flex: 1 },
  spinner: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  spinnerCircle: {
    width: SPINNER_CONTAINER_SIZE,
    height: SPINNER_CONTAINER_SIZE,
    borderRadius: SPINNER_CONTAINER_SIZE / 2,
    backgroundColor: '#242424',
    borderColor: '#3A3A3A',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
