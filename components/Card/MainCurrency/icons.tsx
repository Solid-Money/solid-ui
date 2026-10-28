import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

/** Figma 29236:9920 — "Flag / US", 40pt round. */
export const FlagUsIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Defs>
      <ClipPath id="mainCurrencyFlagUs">
        <Rect width={40} height={40} rx={20} fill="white" />
      </ClipPath>
    </Defs>
    <G clipPath="url(#mainCurrencyFlagUs)">
      <Rect width={40} height={40} rx={20} fill="white" />
      {[0, 6.15385, 12.3077, 18.4615, 24.6154, 30.7692, 36.9231].map(y => (
        <Rect key={y} y={y} width={40} height={3.07692} fill="#C8202E" />
      ))}
      <Rect width={18} height={21.5385} fill="#1E3174" />
      {[
        [4.1, 4.1],
        [9.6, 4.1],
        [15.1, 4.1],
        [6.7, 9],
        [12.2, 9],
        [17.7, 9],
        [4.1, 13.9],
        [9.6, 13.9],
        [15.1, 13.9],
        [6.7, 18.8],
        [12.2, 18.8],
        [17.7, 18.8],
      ].map(([cx, cy]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} fill="white" />
      ))}
    </G>
  </Svg>
);

/** The twelve stars of Figma 29236:9963, one path each. */
const EU_STARS = [
  'M31 17.7L31.56 19.23L33.19 19.29L31.9 20.29L32.35 21.86L31 20.95L29.65 21.86L30.1 20.29L28.81 19.29L30.44 19.23L31 17.7Z',
  'M29.53 23.2L30.08 24.73L31.71 24.79L30.43 25.79L30.88 27.36L29.53 26.45L28.17 27.36L28.62 25.79L27.34 24.79L28.97 24.73L29.53 23.2Z',
  'M25.5 27.23L26.06 28.76L27.69 28.82L26.4 29.82L26.85 31.39L25.5 30.48L24.15 31.39L24.6 29.82L23.31 28.82L24.94 28.76L25.5 27.23Z',
  'M20 28.7L20.56 30.23L22.19 30.29L20.9 31.29L21.35 32.86L20 31.95L18.65 32.86L19.1 31.29L17.81 30.29L19.44 30.23L20 28.7Z',
  'M14.5 27.23L15.06 28.76L16.69 28.82L15.4 29.82L15.85 31.39L14.5 30.48L13.15 31.39L13.6 29.82L12.31 28.82L13.94 28.76L14.5 27.23Z',
  'M10.47 23.2L11.03 24.73L12.66 24.79L11.38 25.79L11.83 27.36L10.47 26.45L9.12 27.36L9.57 25.79L8.29 24.79L9.92 24.73L10.47 23.2Z',
  'M9 17.7L9.56 19.23L11.19 19.29L9.9 20.29L10.35 21.86L9 20.95L7.65 21.86L8.1 20.29L6.81 19.29L8.44 19.23L9 17.7Z',
  'M10.47 12.2L11.03 13.73L12.66 13.79L11.38 14.79L11.83 16.36L10.47 15.45L9.12 16.36L9.57 14.79L8.29 13.79L9.92 13.73L10.47 12.2Z',
  'M14.5 8.17L15.06 9.71L16.69 9.76L15.4 10.77L15.85 12.33L14.5 11.42L13.15 12.33L13.6 10.77L12.31 9.76L13.94 9.71L14.5 8.17Z',
  'M20 6.7L20.56 8.23L22.19 8.29L20.9 9.29L21.35 10.86L20 9.95L18.65 10.86L19.1 9.29L17.81 8.29L19.44 8.23L20 6.7Z',
  'M25.5 8.17L26.06 9.71L27.69 9.76L26.4 10.77L26.85 12.33L25.5 11.42L24.15 12.33L24.6 10.77L23.31 9.76L24.94 9.71L25.5 8.17Z',
  'M29.53 12.2L30.08 13.73L31.71 13.79L30.43 14.79L30.88 16.36L29.53 15.45L28.17 16.36L28.62 14.79L27.34 13.79L28.97 13.73L29.53 12.2Z',
];

/** Figma 29236:9963 — "Flag / EU", 40pt round. */
export const FlagEuIcon = () => (
  <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
    <Path
      d="M20 40C31.0457 40 40 31.0457 40 20C40 8.9543 31.0457 0 20 0C8.9543 0 0 8.9543 0 20C0 31.0457 8.9543 40 20 40Z"
      fill="#1E40AF"
    />
    {EU_STARS.map(d => (
      <Path key={d} d={d} fill="#FFD43B" />
    ))}
  </Svg>
);

/** Figma 29236:9946 — the picked card's green check. */
export const RadioSelectedIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 24C18.6274 24 24 18.6274 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z"
      fill="#94F27F"
    />
    <Path
      d="M7.5 12.3L10.6 15.4L16.5 9.4"
      stroke="#111111"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Figma 29236:9982 — the other card's empty ring. */
export const RadioUnselectedIcon = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
    <Path
      d="M23.25 12C23.25 18.2132 18.2132 23.25 12 23.25C5.7868 23.25 0.75 18.2132 0.75 12C0.75 5.7868 5.7868 0.75 12 0.75C18.2132 0.75 23.25 5.7868 23.25 12Z"
      stroke="white"
      strokeOpacity={0.3}
      strokeWidth={1.5}
    />
  </Svg>
);

/**
 * Figma 29236:9954 ("Icon / tick", 16% fill) and 29236:10597 ("Icon / check", 18% fill): the
 * same green tick on a faint disc, the check a shade stronger on the approval sheet's lighter box.
 */
export const TickIcon = ({
  fillOpacity = 0.16,
  size = 20,
}: {
  fillOpacity?: number;
  /** 16 on the card country screen's availability line; 20 everywhere else. */
  size?: number;
}) => (
  <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <Path
      d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20Z"
      fill="#94F27F"
      fillOpacity={fillOpacity}
    />
    <Path
      d="M6 10.2L8.6 12.8L14 7.4"
      stroke="#94F27F"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
