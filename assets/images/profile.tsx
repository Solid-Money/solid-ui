import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={16}
    height={20}
    viewBox="0 0 16 20"
    fill="none"
    {...props}
  >
    <Path
      d="M7.976 7.976a3.613 3.613 0 1 0 0-7.226 3.613 3.613 0 0 0 0 7.226Zm7.226 6.774c0 2.245 0 4.065-7.226 4.065S.75 16.995.75 14.75s3.235-4.065 7.226-4.065 7.226 1.82 7.226 4.065Z"
      stroke="#fff"
      strokeWidth={1.5}
    />
  </Svg>
);
export default SVGComponent;
