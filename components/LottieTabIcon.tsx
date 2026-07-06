import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import LottieView, { type LottieViewProps } from 'lottie-react-native';

interface LottieTabIconProps {
  source: LottieViewProps['source'];
  focused: boolean;
  size?: number;
}

const WHITE = [1, 1, 1, 1];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeColorValue(value: unknown): unknown {
  if (Array.isArray(value) && value.length >= 3 && value.every(item => typeof item === 'number')) {
    return [WHITE[0], WHITE[1], WHITE[2], typeof value[3] === 'number' ? value[3] : WHITE[3]];
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      if (!isObject(item)) return item;

      return {
        ...item,
        s: normalizeColorValue(item.s),
        e: normalizeColorValue(item.e),
      };
    });
  }

  return value;
}

function normalizeLottieColors(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeLottieColors);
  }

  if (!isObject(value)) {
    return value;
  }

  const next: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    next[key] = normalizeLottieColors(child);
  }

  if ((value.ty === 'st' || value.ty === 'fl') && isObject(next.c)) {
    next.c = {
      ...next.c,
      k: normalizeColorValue(next.c.k),
    };
  }

  return next;
}

export function LottieTabIcon({ source, focused, size = 24 }: LottieTabIconProps) {
  const lottieRef = useRef<LottieView>(null);
  const hasPlayedInitial = useRef(false);
  const normalizedSource = useMemo(
    () => normalizeLottieColors(source) as LottieTabIconProps['source'],
    [source],
  );

  useEffect(() => {
    if (focused) {
      lottieRef.current?.play();
      hasPlayedInitial.current = true;
    } else if (hasPlayedInitial.current) {
      lottieRef.current?.reset();
    }
  }, [focused]);

  return (
    <View style={{ width: size, height: size }}>
      <LottieView
        ref={lottieRef}
        source={normalizedSource}
        autoPlay={focused}
        loop={false}
        style={{ width: '100%', height: '100%' }}
        resizeMode="contain"
      />
    </View>
  );
}
