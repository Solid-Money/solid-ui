import Svg, { G, Path } from 'react-native-svg';

import { IconBadge } from '@/components/Rewards/NewRewards/tierBenefitIcons';

const DIAMOND_PATH =
  'M2.21072 2.02656C2.76301 1.27852 3.03914 0.904502 3.44885 0.702247C3.85856 0.5 4.34009 0.5 5.30316 0.5H9.00001H12.6969C13.6599 0.5 14.1415 0.5 14.5512 0.702247C14.9609 0.904502 15.237 1.27852 15.7893 2.02656L16.3529 2.78986C17.1294 3.84178 17.5178 4.36774 17.4994 4.96068C17.481 5.55361 17.0607 6.05694 16.22 7.0637L11.2413 13.0263C10.5493 13.8551 10.2032 14.2696 9.79951 14.4485C9.29284 14.6732 8.70718 14.6732 8.2005 14.4485C7.79679 14.2696 7.45073 13.8551 6.75871 13.0263L1.77999 7.0637C0.939365 6.05694 0.519058 5.55361 0.500628 4.96068C0.482207 4.36774 0.870522 3.84178 1.64716 2.78986L2.21072 2.02656Z';
const SLASH_PATH =
  'M9.16321 8.50004L8.69135 9.17109C8.41149 9.56911 8.44107 10.0942 8.76408 10.4617L10.5788 12.5264';

/** The completed cashback glyph, shown without the former two-second loop. */
const UpgradeTierCashbackIcon = () => (
  <IconBadge size={33}>
    <Svg width={19} height={21} viewBox="0 0 19 21" fill="none">
      <G transform="translate(0.5 3)">
        <Path d={DIAMOND_PATH} stroke="white" strokeLinejoin="round" />
      </G>
      <Path d={SLASH_PATH} stroke="white" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  </IconBadge>
);

export default UpgradeTierCashbackIcon;
