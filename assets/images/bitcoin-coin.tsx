import * as React from 'react';
import Svg, { Circle, G, Path, SvgProps } from 'react-native-svg';

/** Bitcoin coin mark for the Earn asset grid — BTC has no bundled PNG icon yet. */
const BitcoinCoin = ({ size = 32, ...props }: SvgProps & { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none" {...props}>
    <Circle cx={16} cy={16} r={16} fill="#F7931A" />
    <G stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12.4 9.2v13.6" />
      <Path d="M12.4 9.2h5.1a3.4 3.4 0 0 1 0 6.8h-5.1" />
      <Path d="M12.4 16h5.9a3.4 3.4 0 0 1 0 6.8h-5.9" />
      <Path d="M15.6 6.6v2.6M19.4 6.6v2.6M15.6 22.8v2.6M19.4 22.8v2.6" />
    </G>
  </Svg>
);

export default BitcoinCoin;
