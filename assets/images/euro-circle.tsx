import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * A euro sign in a circle, on the home "Turn on euro spending" prompt (Figma 28856:9632).
 *
 * Strokes only, like the other prompt icons: the design's soft white glow is a Figma
 * drop-shadow filter, which the existing banners leave out too.
 */
const EuroCircle = ({ color = 'white', ...props }: SvgProps & { color?: string }) => (
  <Svg width={78} height={78} viewBox="0 0 78 78" fill="none" {...props}>
    <Path
      d="M69.875 39C69.875 56.0518 56.0518 69.875 39 69.875C21.9482 69.875 8.125 56.0518 8.125 39C8.125 21.9482 21.9482 8.125 39 8.125C56.0518 8.125 69.875 21.9482 69.875 39Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M50.375 27.95C48.2331 25.9981 45.5702 24.7108 42.7101 24.2447C39.8501 23.7785 36.9162 24.1537 34.2654 25.3244C31.6146 26.4951 29.3612 28.411 27.7793 30.8389C26.1974 33.2669 25.3552 36.1022 25.3552 39C25.3552 41.8978 26.1974 44.7331 27.7793 47.1611C29.3612 49.589 31.6146 51.5049 34.2654 52.6756C36.9162 53.8463 39.8501 54.2214 42.7101 53.7553C45.5702 53.2892 48.2331 52.0018 50.375 50.05"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M24.375 35.1H43.875"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M24.375 43.225H40.625"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default EuroCircle;
