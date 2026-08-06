import * as React from 'react';
import Svg, {
  Circle,
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
  <Svg width="292" height="292" viewBox="0 0 292 292" fill="none">
    <G filter="url(#filter0_d_8408_1590)">
      <Circle cx="145.734" cy="145.734" r="109" fill="url(#paint0_linear_8408_1590)" />
    </G>
    <Circle cx="145.734" cy="145.734" r="107" fill="url(#paint1_linear_8408_1590)" />
    <Circle cx="145.734" cy="145.734" r="105" fill="#246E13" fillOpacity="0.75" />
    <G filter="url(#filter1_ii_8408_1590)">
      <Circle cx="145.734" cy="145.734" r="100" fill="url(#paint2_linear_8408_1590)" />
    </G>
    <Circle
      cx="145.734"
      cy="145.734"
      r="94.5"
      stroke="url(#paint3_linear_8408_1590)"
      strokeWidth="11"
    />
    <G filter="url(#filter2_i_8408_1590)">
      <Path
        d="M109.205 161.166C106.069 161.166 103.429 160.686 101.285 159.726C99.141 158.766 97.509 157.422 96.389 155.694C95.301 153.966 94.757 151.982 94.757 149.742H102.341C102.373 150.894 102.629 151.902 103.109 152.766C103.621 153.598 104.389 154.254 105.413 154.734C106.469 155.214 107.829 155.454 109.493 155.454C111.413 155.454 112.949 155.102 114.101 154.398C115.253 153.694 115.829 152.654 115.829 151.278C115.829 150.446 115.701 149.758 115.445 149.214C115.189 148.67 114.741 148.222 114.101 147.87C113.493 147.486 112.661 147.182 111.605 146.958C110.581 146.702 109.269 146.43 107.669 146.142C105.685 145.854 103.925 145.438 102.389 144.894C100.853 144.35 99.573 143.678 98.549 142.878C97.525 142.078 96.757 141.118 96.245 139.998C95.733 138.846 95.477 137.502 95.477 135.966C95.477 133.758 96.021 131.87 97.109 130.302C98.229 128.702 99.813 127.47 101.861 126.606C103.909 125.742 106.341 125.31 109.157 125.31C111.909 125.31 114.277 125.742 116.261 126.606C118.277 127.47 119.829 128.686 120.917 130.254C122.005 131.822 122.549 133.646 122.549 135.726H115.013C114.981 134.606 114.677 133.694 114.101 132.99C113.557 132.286 112.837 131.774 111.941 131.454C111.045 131.134 110.037 130.974 108.917 130.974C107.765 130.974 106.757 131.134 105.893 131.454C105.029 131.774 104.373 132.238 103.925 132.846C103.477 133.454 103.253 134.174 103.253 135.006C103.253 136.062 103.525 136.862 104.069 137.406C104.645 137.95 105.557 138.382 106.805 138.702C108.053 138.99 109.685 139.31 111.701 139.662C113.173 139.886 114.613 140.19 116.021 140.574C117.429 140.958 118.709 141.534 119.861 142.302C121.013 143.038 121.925 144.078 122.597 145.422C123.269 146.734 123.605 148.446 123.605 150.558C123.605 152.638 123.061 154.494 121.973 156.126C120.917 157.726 119.317 158.974 117.173 159.87C115.061 160.734 112.405 161.166 109.205 161.166ZM128.446 168.75V135.006H135.262L135.502 139.47H135.886C136.494 137.998 137.502 136.814 138.91 135.918C140.35 134.99 142.062 134.526 144.046 134.526C145.582 134.526 146.974 134.814 148.222 135.39C149.502 135.934 150.59 136.766 151.486 137.886C152.414 139.006 153.118 140.398 153.598 142.062C154.11 143.726 154.366 145.662 154.366 147.87C154.366 150.814 153.934 153.278 153.07 155.262C152.206 157.246 150.99 158.734 149.422 159.726C147.886 160.718 146.094 161.214 144.046 161.214C142.734 161.214 141.534 161.006 140.446 160.59C139.358 160.174 138.43 159.598 137.662 158.862C136.894 158.126 136.302 157.262 135.886 156.27H135.502V168.75H128.446ZM141.406 155.502C142.558 155.502 143.566 155.23 144.43 154.686C145.294 154.11 145.95 153.262 146.398 152.142C146.878 151.022 147.118 149.598 147.118 147.87C147.118 146.11 146.878 144.67 146.398 143.55C145.95 142.43 145.294 141.598 144.43 141.054C143.566 140.51 142.558 140.238 141.406 140.238C140.094 140.238 139.006 140.542 138.142 141.15C137.278 141.758 136.638 142.542 136.222 143.502C135.806 144.462 135.598 145.502 135.598 146.622V149.118C135.598 149.95 135.71 150.75 135.934 151.518C136.158 152.254 136.51 152.926 136.99 153.534C137.47 154.11 138.078 154.59 138.814 154.974C139.55 155.326 140.414 155.502 141.406 155.502ZM158.821 160.734V135.006H165.877V160.734H158.821ZM158.821 131.694V125.742H165.877V131.694H158.821ZM171.946 160.734V135.006H178.714L179.002 139.662H179.29C179.994 137.934 181.082 136.654 182.554 135.822C184.026 134.958 185.674 134.526 187.498 134.526C188.778 134.526 189.962 134.734 191.05 135.15C192.17 135.534 193.13 136.142 193.93 136.974C194.762 137.806 195.402 138.91 195.85 140.286C196.33 141.63 196.57 143.262 196.57 145.182V160.734H189.514V146.718C189.514 145.278 189.338 144.078 188.986 143.118C188.666 142.158 188.154 141.454 187.45 141.006C186.746 140.526 185.818 140.286 184.666 140.286C183.45 140.286 182.426 140.574 181.594 141.15C180.762 141.726 180.122 142.478 179.674 143.406C179.226 144.334 179.002 145.342 179.002 146.43V160.734H171.946Z"
        fill="#346A29"
      />
    </G>
    <Defs>
      <Filter
        id="filter0_d_8408_1590"
        x="0.000518799"
        y="0.000518799"
        width="291.468"
        height="291.468"
        filterUnits="userSpaceOnUse"
      >
        <FeFlood floodOpacity="0" result="BackgroundImageFix" />
        <FeColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <FeOffset />
        <FeGaussianBlur stdDeviation="18.3669" />
        <FeComposite in2="hardAlpha" operator="out" />
        <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0" />
        <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_8408_1590" />
        <FeBlend
          mode="normal"
          in="SourceGraphic"
          in2="effect1_dropShadow_8408_1590"
          result="shape"
        />
      </Filter>
      <Filter
        id="filter1_ii_8408_1590"
        x="45.7344"
        y="45.7344"
        width="200"
        height="213"
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
        <FeOffset dy="8" />
        <FeGaussianBlur stdDeviation="17.75" />
        <FeComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <FeColorMatrix
          type="matrix"
          values="0 0 0 0 0.141176 0 0 0 0 0.431373 0 0 0 0 0.0745098 0 0 0 1 0"
        />
        <FeBlend mode="normal" in2="shape" result="effect1_innerShadow_8408_1590" />
        <FeColorMatrix
          in="SourceAlpha"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
          result="hardAlpha"
        />
        <FeOffset dy="13" />
        <FeGaussianBlur stdDeviation="7.35" />
        <FeComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <FeColorMatrix
          type="matrix"
          values="0 0 0 0 0.141176 0 0 0 0 0.431373 0 0 0 0 0.0745098 0 0 0 0.25 0"
        />
        <FeBlend
          mode="normal"
          in2="effect1_innerShadow_8408_1590"
          result="effect2_innerShadow_8408_1590"
        />
      </Filter>
      <Filter
        id="filter2_i_8408_1590"
        x="94.7578"
        y="125.309"
        width="101.812"
        height="47.4414"
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
        <FeOffset dy="4" />
        <FeGaussianBlur stdDeviation="2" />
        <FeComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
        <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
        <FeBlend mode="normal" in2="shape" result="effect1_innerShadow_8408_1590" />
      </Filter>
      <LinearGradient
        id="paint0_linear_8408_1590"
        x1="145.734"
        y1="36.7344"
        x2="145.734"
        y2="254.734"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#84E46E" />
        <Stop offset="1" stopColor="#8CE678" />
      </LinearGradient>
      <LinearGradient
        id="paint1_linear_8408_1590"
        x1="145.734"
        y1="38.7344"
        x2="145.734"
        y2="252.734"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#52C839" />
        <Stop offset="1" stopColor="#C0FBB3" />
      </LinearGradient>
      <LinearGradient
        id="paint2_linear_8408_1590"
        x1="145.734"
        y1="45.7344"
        x2="145.734"
        y2="245.734"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#84E46F" />
        <Stop offset="1" stopColor="#82D96F" />
      </LinearGradient>
      <LinearGradient
        id="paint3_linear_8408_1590"
        x1="145.734"
        y1="45.7344"
        x2="145.734"
        y2="245.734"
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset="0.491984" stopColor="#52C839" stopOpacity="0" />
        <Stop offset="1" stopColor="#4AB933" />
      </LinearGradient>
    </Defs>
  </Svg>
);

export default SvgComponent;
