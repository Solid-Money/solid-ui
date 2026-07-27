import * as React from 'react';
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
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

const SvgComponent = () => (
  <Svg width="112" height="98" viewBox="95.9816 10.7772 111.882 97.7321" fill="none">
    <G filter="url(#shadow)">
      <Path
        d="M159.776 91.7475C156.173 97.5935 147.673 97.5936 144.07 91.7475L106.669 31.0676C102.881 24.9216 107.303 17.0026 114.522 17.0026L189.324 17.0026C196.543 17.0026 200.965 24.9216 197.177 31.0675L159.776 91.7475Z"
        fill="url(#outer)"
      />
    </G>
    <Path
      d="M156.006 78.2362C154.172 81.3357 149.685 81.3294 147.86 78.2247L122.014 34.2611C120.16 31.1086 122.433 27.1355 126.09 27.1355L177.949 27.1355C181.612 27.1355 183.884 31.1202 182.019 34.2726L156.006 78.2362Z"
      fill="url(#inner)"
    />
    <Defs>
      <Filter
        id="shadow"
        x="95.9816"
        y="10.7772"
        width="111.882"
        height="97.7321"
        filterUnits="userSpaceOnUse"
      >
        <FeFlood floodOpacity="0" result="BackgroundImageFix" />
        <FeColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <FeOffset dy="3.07491" />
        <FeGaussianBlur stdDeviation="4.6508" />
        <FeComposite in2="hardAlpha" operator="out" />
        <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
        <FeBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
      </Filter>
      <LinearGradient
        id="outer"
        x1="151.923"
        y1="17.0026"
        x2="151.923"
        y2="104.488"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#C6FEBA" />
        <Stop offset="1" stopColor="#84DA71" />
      </LinearGradient>
      <LinearGradient
        id="inner"
        x1="151.924"
        y1="31.5419"
        x2="151.924"
        y2="85.1367"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#84E46F" />
        <Stop offset="1" stopColor="#81D26F" />
      </LinearGradient>
    </Defs>
  </Svg>
);

export default SvgComponent;
