import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={50} height={50} fill="none" {...props}>
    <Path
      fill="#4D4D4D"
      d="M0 25C0 11.193 11.193 0 25 0s25 11.193 25 25-11.193 25-25 25S0 38.807 0 25Z"
    />
    <Path
      stroke={color}
      strokeWidth={1.5}
      d="M16.333 18.5v14.084a3.25 3.25 0 0 0 3.25 3.25h10.834a3.25 3.25 0 0 0 3.25-3.25V21.75a3.25 3.25 0 0 0-3.25-3.25H16.333Zm0 0v-1.083"
    />
    <Path
      fill={color}
      d="M31.5 18.877v.813h.812v-.813H31.5Zm-14.006.813H31.5v-1.625H17.494v1.625Zm14.818-.813v-1.835h-1.625v1.835h1.625Zm-3.4-4.784-11.697 1.671.23 1.609 11.697-1.671-.23-1.609Zm-11.697 1.671a1.973 1.973 0 0 0-1.694 1.953h1.625c0-.173.127-.32.298-.344l-.23-1.609Zm15.097 1.278a2.98 2.98 0 0 0-3.4-2.949l.23 1.609a1.354 1.354 0 0 1 1.545 1.34h1.625Zm-14.818 1.023a.348.348 0 0 1-.348-.348H15.52c0 1.09.883 1.973 1.973 1.973v-1.625Z"
    />
    <Path
      stroke={color}
      strokeLinecap="round"
      strokeWidth={1.5}
      d="M20.666 25h8.667M20.666 28.8h5.959"
    />
  </Svg>
);

export default SvgComponent;
