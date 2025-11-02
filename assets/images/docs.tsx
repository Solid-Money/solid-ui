import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    fill="none"
    {...props}
  >
    <Path
      d="M3.332 5v10.833a2.5 2.5 0 0 0 2.5 2.5h8.333a2.5 2.5 0 0 0 2.5-2.5V7.5a2.5 2.5 0 0 0-2.5-2.5zm0 0v-.833"
      stroke="#fff"
      strokeWidth={1.5}
    />
    <Path
      d="M14.999 5v.624h.625V5zm-10.774.624h10.774v-1.25H4.225zM15.624 5V3.588h-1.25v1.411zm-2.616-3.68L4.01 2.605l.177 1.237 8.998-1.285zM4.01 2.605a1.52 1.52 0 0 0-1.303 1.502h1.25c0-.133.098-.246.23-.265zm11.614.983a2.292 2.292 0 0 0-2.616-2.269l.177 1.238a1.042 1.042 0 0 1 1.189 1.03zm-11.4.786a.27.27 0 0 1-.267-.267h-1.25c0 .838.68 1.517 1.518 1.517z"
      fill="#fff"
    />
    <Path
      d="M6.664 10h6.667m-6.667 2.917h4.583"
      stroke="#fff"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
);
export default SVGComponent;
