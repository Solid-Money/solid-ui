import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={14}
    height={14}
    viewBox="0 0 14 14"
    fill="none"
    {...props}
  >
    <Path
      d="M6.932 10.913a.64.64 0 0 0 .469-.19.64.64 0 0 0 .19-.469.64.64 0 0 0-.19-.47.64.64 0 0 0-.47-.189.64.64 0 0 0-.468.19.64.64 0 0 0-.19.47.64.64 0 0 0 .19.468.64.64 0 0 0 .469.19M6.32 8.074h1.224V3.15H6.32zm-2.274 5.928L0 9.96V4.184L4.043.14h5.775l4.046 4.042v5.776L9.82 14.002zm.52-1.223h4.73l3.345-3.343v-4.73L9.297 1.362h-4.73L1.223 4.706v4.73z"
      fill="#FF7474"
    />
  </Svg>
);
export default SVGComponent;
