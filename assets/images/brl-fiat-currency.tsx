import * as React from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect, SvgProps } from 'react-native-svg';

// Brazilian flag: green background, yellow diamond, blue circle with stars
const SvgComponent = (props: SvgProps) => (
  <Svg width={21} height={22} fill="none" {...props}>
    <G clipPath="url(#a)">
      {/* Green background */}
      <Rect x={0} y={0.907} width={21} height={21} fill="#009739" />
      {/* Yellow diamond */}
      <Path fill="#FEDD00" d="M10.5 3.407l8 8-8 8-8-8z" />
      {/* Blue circle */}
      <Path fill="#012169" d="M10.5 6.907a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
      {/* White band across circle */}
      <Path
        fill="#FFFFFF"
        d="M6.5 10.907c0-.3.1-.5.2-.7 1.1.3 2.4.5 3.8.5s2.7-.2 3.8-.5c.1.2.2.5.2.7 0 .3-.1.5-.2.7-1.1-.3-2.4-.5-3.8-.5s-2.7.2-3.8.5c-.1-.2-.2-.4-.2-.7z"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Rect width={21} height={21} y={0.907} fill="#fff" rx={10.5} />
      </ClipPath>
    </Defs>
  </Svg>
);

export default SvgComponent;
