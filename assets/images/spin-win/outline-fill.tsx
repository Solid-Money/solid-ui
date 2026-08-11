import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

export type OutlineFillVariant = 'green' | 'yellow' | 'purple';

// Brighter takes on the wheel's own sector colours, so the fill reads as the
// segment lighting up. Light at the rim, deepening toward the hub — matching the
// gradient direction of `outline.tsx`.
const GRADIENTS: Record<OutlineFillVariant, [string, string, string]> = {
  green: ['#C6FFBA', '#84E46F', '#448E34'],
  yellow: ['#FFF1B8', '#FFD151', '#8E6A34'],
  purple: ['#F2CCFF', '#C56ADC', '#5E2A70'],
};

export type OutlineFillProps = {
  variant?: OutlineFillVariant;
};

// The wedge interior of `outline.tsx` — the inner boundary of that shape, filled
// with a translucent gradient so the winning prize stays readable through it.
const SvgComponent = ({ variant = 'green' }: OutlineFillProps) => {
  const [rim, mid, hub] = GRADIENTS[variant];
  const gradientId = `sectorFill-${variant}`;

  return (
    <Svg width="304" height="418" viewBox="0 0 304 418" fill="none">
      <Path
        d="M152.033 390.08C152.727 391.721 155.058 391.705 155.728 390.054L277.131 91.0758C277.56 90.0192 277.022 88.9467 276.123 88.6052C195.919 58.1522 107.211 58.7714 27.4409 90.3415C26.5465 90.6955 26.024 91.7755 26.4678 92.8261L152.033 390.08Z"
        fill={`url(#${gradientId})`}
      />
      <Defs>
        <LinearGradient
          id={gradientId}
          x1="151.5"
          y1="60"
          x2="151.5"
          y2="392"
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor={rim} stopOpacity="0.62" />
          <Stop offset="0.55" stopColor={mid} stopOpacity="0.48" />
          <Stop offset="1" stopColor={hub} stopOpacity="0.34" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
};

export default SvgComponent;
