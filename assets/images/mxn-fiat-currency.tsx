import * as React from 'react';
import Svg, { ClipPath, Defs, G, Path, Rect, SvgProps } from 'react-native-svg';

// Mexican flag: green, white, red vertical stripes
const SvgComponent = (props: SvgProps) => (
  <Svg width={21} height={22} fill="none" {...props}>
    <G clipPath="url(#a)">
      {/* Green stripe (left) */}
      <Path fill="#006847" d="M0 0.907h7v21H0z" />
      {/* White stripe (center) */}
      <Path fill="#FFFFFF" d="M7 0.907h7v21H7z" />
      {/* Red stripe (right) */}
      <Path fill="#CE1126" d="M14 0.907h7v21H14z" />
      {/* Simplified coat of arms (eagle silhouette in center) */}
      <G>
        <Path
          fill="#006847"
          d="M10.5 8.407c-.8 0-1.5.4-1.9 1-.2.3-.1.6.1.8.2.2.5.3.7.2.3-.1.6-.2.9-.2.3 0 .6.1.9.2.2.1.5 0 .7-.2.2-.2.3-.5.1-.8-.4-.6-1.1-1-1.5-1z"
        />
        <Path
          fill="#6D3A14"
          d="M10.5 10.407c-.3 0-.5.1-.7.3-.2.2-.3.4-.3.7 0 .5.4 1 1 1s1-.5 1-1c0-.3-.1-.5-.3-.7-.2-.2-.4-.3-.7-.3z"
        />
      </G>
    </G>
    <Defs>
      <ClipPath id="a">
        <Rect width={21} height={21} y={0.907} fill="#fff" rx={10.5} />
      </ClipPath>
    </Defs>
  </Svg>
);

export default SvgComponent;
