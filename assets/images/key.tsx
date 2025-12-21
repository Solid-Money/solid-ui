import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = ({color = '#000', ...props}: SvgProps) => (
  <Svg
    width={22}
    height={11}
    viewBox="0 0 22 11"
    fill="none"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5.419 0a5.42 5.42 0 0 1 5.217 3.948h9.616c.684 0 1.238.554 1.238 1.238v4.558h-1.915V8.399s.064-.721-.936-.721-1.001.72-1.001.72v1.346h-1.916V6.796h-5.06A5.419 5.419 0 1 1 5.42 0M2.88 5.419a2.551 2.551 0 1 1 5.101 0 2.551 2.551 0 0 1-5.102 0"
      fill={color}
    />
  </Svg>
);
export default SVGComponent;
