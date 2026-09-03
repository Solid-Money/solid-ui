import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/**
 * The mouth inside the brackets. Everything else about the glyph is identical
 * between the two states the design draws (Figma 25141:7081 vs 25141:7195), so
 * the expression is the only thing that varies.
 */
const MOUTH_PATH = {
  /** Smiling — the encouraging states (get card, finish verification, ready). */
  smile:
    'M30.2917 51.5833C32.8782 53.5005 36.024 54.625 39.4167 54.625C42.8093 54.625 45.955 53.5005 48.5417 51.5833',
  /** Flat — the "your verification declined" card. */
  flat: 'M30.9167 54.6249C33.4167 54.6251 36.024 54.6251 39.4167 54.6251C42.8093 54.6251 45.4167 54.625 48.4167 54.6251',
} as const;

export type FaceScanExpression = keyof typeof MOUTH_PATH;

/**
 * Face-scan brackets used on the home verification prompts (Figma 20172:8385).
 *
 * `expression` picks the mouth: the declined banner draws the same face with a
 * flat one instead of a smile, which is the whole difference between the two
 * assets in the design.
 */
const FaceScan = ({
  color = 'white',
  expression = 'smile',
  ...props
}: SvgProps & { color?: string; expression?: FaceScanExpression }) => (
  <Svg width={73} height={73} viewBox="0 0 78.8333 78.8333" fill="none" {...props}>
    <Path d={MOUTH_PATH[expression]} stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path
      d="M48.5417 39.4167C50.2215 39.4167 51.5833 37.374 51.5833 34.8542C51.5833 32.3344 50.2215 30.2917 48.5417 30.2917C46.8618 30.2917 45.5 32.3344 45.5 34.8542C45.5 37.374 46.8618 39.4167 48.5417 39.4167Z"
      fill={color}
    />
    <Path
      d="M30.2917 39.4167C31.9715 39.4167 33.3333 37.374 33.3333 34.8542C33.3333 32.3344 31.9715 30.2917 30.2917 30.2917C28.6118 30.2917 27.25 32.3344 27.25 34.8542C27.25 37.374 28.6118 39.4167 30.2917 39.4167Z"
      fill={color}
    />
    <Path
      d="M69.8333 45.5C69.8333 56.9707 69.8333 62.7064 66.2697 66.2697C62.7064 69.8333 56.9707 69.8333 45.5 69.8333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M33.3333 69.8333C21.8625 69.8333 16.1271 69.8333 12.5635 66.2697C9 62.7064 9 56.9707 9 45.5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M33.3333 9C21.8625 9 16.1271 9 12.5635 12.5635C9 16.1271 9 21.8625 9 33.3333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Path
      d="M45.5 9C56.9707 9 62.7064 9 66.2697 12.5635C69.8333 16.1271 69.8333 21.8625 69.8333 33.3333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

export default FaceScan;
