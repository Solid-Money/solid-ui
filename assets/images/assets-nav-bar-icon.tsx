import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';

const SvgComponent = ({ color = '#9A9A9A', ...props }: SvgProps) => (
  <Svg xmlns="http://www.w3.org/2000/svg" width={21} height={17} fill="none" {...props}>
    <Path
      fill={color}
      d="M18.965 5.098c-.078-1.872-.328-3.02-1.137-3.828C16.657.098 14.771.098 11 .098H8c-3.771 0-5.657 0-6.828 1.172C0 2.44 0 4.327 0 8.098c0 3.771 0 5.657 1.172 6.829C2.343 16.098 4.229 16.098 8 16.098h3c3.771 0 5.657 0 6.828-1.171.809-.809 1.06-1.957 1.137-3.829"
    />
    <Path
      fill={color}
      stroke="#30302E"
      strokeWidth={1.5}
      d="M18.833 5.098h-2.602c-1.785 0-3.231 1.343-3.231 3s1.447 3 3.23 3h2.603c.084 0 .125 0 .16-.002.54-.033.97-.432 1.005-.932.002-.033.002-.072.002-.15V6.182c0-.077 0-.116-.002-.148-.036-.501-.465-.9-1.005-.933-.035-.002-.076-.002-.16-.002Z"
    />
    <Path fill={color} d="M15.991 8.098h.01-.01Z" />
    <Path
      stroke="#94F27F"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.991 8.098h.01"
    />
  </Svg>
);

export default SvgComponent;
