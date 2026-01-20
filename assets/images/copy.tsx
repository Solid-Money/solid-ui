import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={16}
    height={15}
    viewBox="0 0 16 15"
    fill="none"
    {...props}
  >
    <Path
      d="M1.513 0A1.506 1.506 0 0 0 0 1.5V12h1.513V1.5h10.586V0zm3.024 3a1.505 1.505 0 0 0-1.513 1.5v9A1.505 1.505 0 0 0 4.537 15h9.074a1.504 1.504 0 0 0 1.512-1.5v-9A1.51 1.51 0 0 0 13.611 3zm0 1.5h9.074v9H4.537z"
      fill="#fff"
      fillOpacity={0.7}
    />
  </Svg>
);
export default SVGComponent;
