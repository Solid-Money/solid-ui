import * as React from 'react';
import Svg, { Path, SvgProps } from 'react-native-svg';
const SVGComponent = ({ color = '#FFFFFF', ...props }: SvgProps) => (
  <Svg width={20} height={20} viewBox="-1 -1 20 20" fill="none" {...props}>
    <Path
      d="M12.5648 4.95985H16.2656C16.776 4.95985 17.19 5.37385 17.19 5.88505V16.0601L14.107 13.4983C13.9403 13.3609 13.7312 13.2853 13.5152 13.2845H6.0898C5.5786 13.2845 5.16532 12.8705 5.16532 12.36V9.58441M5.16532 9.58441L4.21492 9.58513C3.99892 9.58513 3.78868 9.66073 3.62308 9.79825L0.540039 12.36V2.18497C0.540039 1.67377 0.954039 1.25977 1.46524 1.25977H11.6396C12.15 1.25977 12.564 1.67377 12.564 2.18497V4.96057V8.65993C12.564 9.17113 12.15 9.58441 11.6396 9.58441H5.16532Z"
      stroke={color}
      strokeOpacity={0.7}
      strokeWidth={1.08}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
export default SVGComponent;
