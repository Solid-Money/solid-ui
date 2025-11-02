import * as React from "react";
import Svg, { G, Path, Defs, ClipPath, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={20}
    height={17}
    viewBox="0 0 20 17"
    fill="none"
    {...props}
  >
    <G clipPath="url(#a)" stroke="#fff" strokeWidth={1.5} strokeLinecap="round">
      <Path d="M6.668 4.958c.009-1.54.08-2.375.65-2.919.65-.622 1.698-.622 3.793-.622h.74c2.096 0 3.144 0 3.794.622.651.623.651 1.624.651 3.628v5.666c0 2.004 0 3.006-.65 3.628-.651.622-1.699.622-3.794.622h-.74c-2.096 0-3.144 0-3.794-.622-.57-.544-.641-1.379-.65-2.92" />
      <Path
        d="M11.11 8.5H1.48m0 0 2.593-2.125M1.48 8.5l2.593 2.125"
        strokeLinejoin="round"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h20v17H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SVGComponent;
