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
  <Svg width="74" height="87" viewBox="0 0 149 174" fill="none">
    <G filter="url(#filter0_i_8437_1538)">
      <Path
        d="M73.9797 0.301412C71.5202 -0.53144 68.7976 0.401521 67.3452 2.5661L17.0191 77.5172C16.0091 79.0265 15.772 80.9166 16.352 82.6259C16.9319 84.3352 18.2694 85.6706 19.9718 86.2435L47.0489 95.5395L0.943374 164.228C-0.520376 166.492 -0.259442 169.464 1.57803 171.409C3.42572 173.358 6.36265 173.766 8.67227 172.403L145.252 90.22C147.213 89.0719 148.327 86.8603 148.089 84.5881C147.861 82.3195 146.321 80.4074 144.175 79.6938L110.109 67.9983L135.998 29.3081C136.98 27.8124 137.234 25.9396 136.671 24.2476C136.112 22.5453 134.798 21.2067 133.124 20.6202L73.9797 0.301412Z"
        fill={FLASH_COLORS[variant]}
      />
    </G>
    <Defs>
      <Filter
        id="filter0_i_8437_1538"
        x="0"
        y="0"
        width="148.121"
        height="173.203"
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
        <FeBlend mode="normal" in2="shape" result="effect1_innerShadow_8437_1538" />
      </Filter>
    </Defs>
  </Svg>
);

export default SvgComponent;
