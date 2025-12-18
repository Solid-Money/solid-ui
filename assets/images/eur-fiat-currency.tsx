import * as React from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, SvgProps } from 'react-native-svg';

const SvgComponent = (props: SvgProps) => (
  <Svg width={21} height={22} fill="none" {...props}>
    <G clipPath="url(#a)">
      {/* Blue background */}
      <Circle cx={10.5} cy={11.407} r={10.5} fill="#003399" />

      {/* 12 golden stars in a circle */}
      {/* Star at 12 o'clock */}
      <Path
        fill="#FFCC00"
        d="M10.5 3.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 1 o'clock */}
      <Path
        fill="#FFCC00"
        d="M13.82 4.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 2 o'clock */}
      <Path
        fill="#FFCC00"
        d="M16.12 7.407l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 3 o'clock */}
      <Path
        fill="#FFCC00"
        d="M17.12 10.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 4 o'clock */}
      <Path
        fill="#FFCC00"
        d="M16.12 14.407l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 5 o'clock */}
      <Path
        fill="#FFCC00"
        d="M13.82 16.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 6 o'clock */}
      <Path
        fill="#FFCC00"
        d="M10.5 17.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 7 o'clock */}
      <Path
        fill="#FFCC00"
        d="M7.18 16.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 8 o'clock */}
      <Path
        fill="#FFCC00"
        d="M4.88 14.407l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 9 o'clock */}
      <Path
        fill="#FFCC00"
        d="M3.88 10.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 10 o'clock */}
      <Path
        fill="#FFCC00"
        d="M4.88 7.407l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
      />
      {/* Star at 11 o'clock */}
      <Path
        fill="#FFCC00"
        d="M7.18 4.907l.35 1.08h1.13l-.92.67.35 1.08-.92-.67-.92.67.35-1.08-.92-.67h1.13z"
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
