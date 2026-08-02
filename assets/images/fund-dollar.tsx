import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

/** Incoming-dollar circle used on the home "Fund your wallet" prompt (Figma 21315:7728). */
const FundDollar = ({ color = 'white', ...props }: SvgProps & { color?: string }) => (
  <Svg width={63} height={62} viewBox="0 0 63.1539 62" fill="none" {...props}>
    <Path
      d="M11.1923 17.6667H4.39744M11.1923 44.3333H4.39744M11.1923 31H1M14.5897 6.05183C19.4484 2.8609 25.2913 1 31.5769 1C48.4642 1 62.1539 14.4315 62.1539 31C62.1539 47.5687 48.4642 61 31.5769 61C25.2913 61 19.4484 59.139 14.5897 55.9483M38.3718 22.6664C36.6731 22.253 33.9045 22.2378 31.5769 22.253M31.5769 22.253C30.7986 22.2581 31.2691 22.2256 30.218 22.253C27.4749 22.3369 24.7875 23.4555 24.7821 26.6247C24.7761 30.0007 28.1795 30.9997 31.5769 30.9997C34.9744 30.9997 38.3718 31.7703 38.3718 35.3747C38.3718 38.0833 35.6284 39.2703 32.2092 39.6633C31.9901 39.6633 31.7798 39.6637 31.5769 39.6647M31.5769 22.253V17.6667M31.5769 39.6647C29.266 39.674 27.9053 39.716 24.7821 39.333M31.5769 39.6647V44.3333"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default FundDollar;
