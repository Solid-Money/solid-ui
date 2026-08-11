import Svg, {
  Defs,
  FeBlend,
  FeColorMatrix,
  FeComposite,
  FeFlood,
  FeGaussianBlur,
  FeOffset,
  Filter,
  G,
  Path,
} from 'react-native-svg';

import type { OutlineFillVariant } from './outline-fill';

// One muted, mid-dark tone per sector so the bolt stays legible against the
// brighter wedge fill behind it.
const FLASH_COLORS: Record<OutlineFillVariant, string> = {
  green: '#5A924D',
  yellow: '#937E4D',
  purple: '#854D93',
};

const SvgComponent = ({ variant = 'green' }: { variant?: OutlineFillVariant }) => (
  <Svg width="46" height="148" viewBox="0 0 92 148" fill="none">
    <G filter="url(#filter0_i_8437_1537)">
      <Path
        d="M1.50293 32.729C-0.00170096 34.0505 -0.427117 36.2301 0.460349 38.0369L31.1764 100.623C31.7962 101.881 32.9685 102.77 34.3348 103.043C35.7011 103.316 37.1093 102.938 38.1484 102.022L54.798 87.522L82.9534 144.868C83.9032 146.721 85.9906 147.695 87.9991 147.219C90.0139 146.737 91.4191 144.933 91.3979 142.863L89.0857 19.8521C89.0739 18.0979 88.0246 16.4992 86.4138 15.7803C84.8092 15.0559 82.9374 15.3461 81.6333 16.5041L60.686 34.7467L44.7957 2.49931C44.1743 1.2649 43.0201 0.371549 41.6719 0.0939839C40.3182 -0.189959 38.917 0.170432 37.8796 1.06275L1.50293 32.729Z"
        fill={FLASH_COLORS[variant]}
      />
    </G>
    <Defs>
      <Filter
        id="filter0_i_8437_1537"
        x="0"
        y="0"
        width="91.3984"
        height="147.34"
        filterUnits="userSpaceOnUse"
      >
        <FeFlood floodOpacity="0" result="BackgroundImageFix" />
        <FeBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
        <FeColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <FeOffset />
        <FeGaussianBlur stdDeviation="10.8" />
        <FeComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <FeColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" />
        <FeBlend mode="normal" in2="shape" result="effect1_innerShadow_8437_1537" />
      </Filter>
    </Defs>
  </Svg>
);

export default SvgComponent;
