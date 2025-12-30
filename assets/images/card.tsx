import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={16}
    height={13}
    viewBox="0 0 16 13"
    fill="none"
    {...props}
  >
    <Path
      d="M.75 6.345c0-2.638 0-3.956.82-4.776C2.388.75 3.706.75 6.344.75h2.797c2.637 0 3.956 0 4.775.82.82.819.82 2.137.82 4.775 0 2.637 0 3.956-.82 4.775-.819.82-2.138.82-4.775.82H6.345c-2.638 0-3.956 0-4.776-.82S.75 8.982.75 6.345Z"
      stroke="#fff"
      strokeWidth={1.5}
    />
    <Path
      d="M.75 4.946h13.987"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);
export default SVGComponent;
