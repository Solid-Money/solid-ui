import * as React from "react";
import Svg, { Path, SvgProps } from "react-native-svg";
const SVGComponent = (props: SvgProps) => (
  <Svg
    width={16}
    height={18}
    viewBox="0 0 16 18"
    fill="none"
    {...props}
  >
    <Path
      d="m13.268 3.432-.716 10.742c-.063.94-.094 1.41-.297 1.767a1.8 1.8 0 0 1-.774.724c-.37.18-.841.18-1.784.18H6.109c-.943 0-1.414 0-1.783-.18a1.8 1.8 0 0 1-.774-.724c-.204-.356-.235-.827-.298-1.767L2.538 3.432m-1.788 0h14.306m-3.576 0-.242-.726c-.235-.703-.352-1.055-.57-1.315a1.8 1.8 0 0 0-.717-.517C9.636.75 9.265.75 8.523.75h-1.24c-.742 0-1.112 0-1.428.124-.279.11-.525.287-.717.517-.218.26-.335.612-.57 1.315l-.241.726"
      stroke="#fff"
      strokeOpacity={0.7}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SVGComponent;
