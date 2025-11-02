import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={10}
    height={16}
    viewBox="0 0 10 16"
    fill="none"
    {...props}
  >
    <Path
      d="M1 3.617a3.916 3.916 0 0 1 7.611 1.305c0 2.611-3.916 3.917-3.916 3.917v1.43"
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M4.797 14.06h.014"
      stroke="#fff"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SVGComponent;
