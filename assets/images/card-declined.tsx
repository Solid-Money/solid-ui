import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * A card with a cross, on the home "Your payment was declined" prompt (Figma 28856:9590).
 *
 * Strokes only, like the other prompt icons: the design's soft white glow is a Figma
 * drop-shadow filter, which the existing banners leave out too.
 */
const CardDeclined = ({ color = 'white', ...props }: SvgProps & { color?: string }) => (
  <Svg width={77} height={77} viewBox="0 0 77 77" fill="none" {...props}>
    <Path
      d="M14.4375 16.0417H62.5625C66.9923 16.0417 70.5833 19.6327 70.5833 24.0625V52.9375C70.5833 57.3673 66.9923 60.9583 62.5625 60.9583H14.4375C10.0077 60.9583 6.41667 57.3673 6.41667 52.9375V24.0625C6.41667 19.6327 10.0077 16.0417 14.4375 16.0417Z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.41667 32.0833H70.5833"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M46.5208 41.7083L56.1458 51.3333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M56.1458 41.7083L46.5208 51.3333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default CardDeclined;
