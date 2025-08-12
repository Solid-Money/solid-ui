import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={20}
    height={16}
    viewBox="0 0 20 16"
    fill="none"
    {...props}
  >
    <Path
      d="M3.94458 0.789062L1.93008 3.60039C1.45592 4.26211 1.92888 5.18285 2.74294 5.18285H18.213"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M16.0559 15.2598L18.0704 12.4484C18.5446 11.7867 18.0716 10.866 17.2576 10.866L1.78751 10.866"
      stroke="white"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);
export default SVGComponent;
