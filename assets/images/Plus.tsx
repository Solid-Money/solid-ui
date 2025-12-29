import * as React from "react";
import Svg, { Rect, G, Path, Defs, ClipPath, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={43}
    height={43}
    viewBox="0 0 43 43"
    fill="none"
    {...props}
  >
    <Rect width={43} height={43} rx={21.5} fill="#fff" fillOpacity={0.25} />
    <G clipPath="url(#a)">
      <Path
        d="M22.253 29.803v-7.535l7.534.146a.74.74 0 0 0 .754-.739.77.77 0 0 0-.754-.768l-7.534-.146v-7.536a.77.77 0 0 0-.753-.768.74.74 0 0 0-.753.74v7.534l-7.534-.146a.74.74 0 0 0-.754.739.77.77 0 0 0 .754.768l7.534.146v7.536a.77.77 0 0 0 .753.768.74.74 0 0 0 .753-.74"
        fill="#fff"
        fillOpacity={0.7}
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M30.54 12.633v18.085l-18.082-.351V12.282z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SVGComponent;
