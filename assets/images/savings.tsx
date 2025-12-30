import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={15}
    height={18}
    viewBox="0 0 15 18"
    fill="none"
    {...props}
  >
    <Path
      d="M9.42.75H4.86c-.143 0-.214 0-.277.022a.4.4 0 0 0-.148.092c-.047.046-.079.11-.143.237L.962 7.759c-.152.304-.228.456-.21.58a.4.4 0 0 0 .166.266c.102.072.272.072.611.072h4.92L4.07 16.603l9.665-10.022c.326-.339.489-.508.498-.652a.4.4 0 0 0-.14-.33c-.11-.093-.345-.093-.815-.093h-5.64z"
      stroke="#fff"
      strokeOpacity={0.5}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SVGComponent;
