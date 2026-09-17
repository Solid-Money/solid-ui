import { type ReactElement } from 'react';
import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';

/**
 * The circular benefit glyphs the rewards screens share.
 *
 * Lifted out of `TierBenefitsGrid` when the upgrade screens needed the same
 * marks at a smaller size. They are one set rather than two because they are
 * one set in the design: the same cashback diamond and yield-boost bolt appear
 * on the benefits grid at 50px and inside the upgrade card's tier summary at
 * 33px, and a second copy is how the two would drift apart.
 */

/** The circle every benefit icon sits in. 50px on the grid, 33px on a tier card. */
export const IconBadge = ({ children, size = 50 }: { children: ReactElement; size?: number }) => (
  <View
    className="items-center justify-center rounded-full bg-white/10"
    style={{ width: size, height: size }}
  >
    {children}
  </View>
);

const CASHBACK_DIAMOND_PATH =
  'M3.06451 2.81534C3.81171 1.80329 4.18531 1.29727 4.73962 1.02363C5.29394 0.750001 5.94542 0.750001 7.2484 0.750001H12.25H17.2517C18.5546 0.750001 19.2061 0.750001 19.7604 1.02363C20.3148 1.29727 20.6883 1.80329 21.4355 2.81534L22.198 3.84805C23.2487 5.27123 23.7741 5.98283 23.7492 6.78503C23.7243 7.58723 23.1556 8.26822 22.0182 9.6303L15.2824 17.6974C14.3461 18.8187 13.8779 19.3794 13.3317 19.6215C12.6462 19.9255 11.8538 19.9255 11.1683 19.6215C10.6221 19.3794 10.1539 18.8187 9.21767 17.6974L2.48175 9.6303C1.34443 8.26822 0.775785 7.58723 0.75085 6.78503C0.725927 5.98283 1.25129 5.27123 2.30204 3.84805L3.06451 2.81534Z';
const CASHBACK_SLASH_PATH =
  'M1.64728 0.750063L1.00889 1.65796C0.630253 2.19645 0.67028 2.90693 1.10728 3.4041L3.56244 6.19743';
// Lightning bolt with speed lines, drawn at the badge's own 50x49 scale so it
// lands exactly where the design places it inside the circle.
const YIELD_BOOST_PATH =
  'M20.4366 32.3333H13.0221M17.0664 25H11M20.4366 17.6667H13.6962M31.2214 13L22.3288 25.3133C21.9352 25.8584 21.7384 26.1308 21.7469 26.358C21.7543 26.5559 21.8503 26.7401 22.0087 26.8611C22.1907 27 22.5292 27 23.2064 27H29.8733L28.5252 37L37.4178 24.6867C37.8114 24.1416 38.0082 23.8692 37.9997 23.642C37.9923 23.4441 37.8963 23.2599 37.7379 23.1389C37.5559 23 37.2174 23 36.5402 23H29.8733L31.2214 13Z';

export const CashbackIcon = ({ size = 50 }: { size?: number }) => (
  <IconBadge size={size}>
    <Svg
      width={(size / 50) * 24.5}
      height={(size / 50) * 20.5995}
      viewBox="0 0 24.5 20.5995"
      fill="none"
    >
      <Path d={CASHBACK_DIAMOND_PATH} stroke="white" strokeWidth={1.5} strokeLinejoin="round" />
      <G transform="translate(6.77244 4.23695)">
        <Path
          d={CASHBACK_SLASH_PATH}
          stroke="white"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  </IconBadge>
);

export const ReferralsIcon = ({ size = 50 }: { size?: number }) => (
  <IconBadge size={size}>
    <Svg width={(size / 50) * 28} height={(size / 50) * 21} viewBox="0 0 28 21" fill="none">
      <G transform="translate(0 6)">
        <Path
          d="M5.69163 5.69116C7.05609 5.69116 8.16221 4.58505 8.16221 3.22058C8.16221 1.85612 7.05609 0.75 5.69163 0.75C4.32716 0.75 3.22105 1.85612 3.22105 3.22058C3.22105 4.58505 4.32716 5.69116 5.69163 5.69116Z"
          stroke="white"
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
        <Path
          d="M10.6326 10.3234C10.6326 11.8584 10.6326 13.1028 5.69142 13.1028C0.750254 13.1028 0.750254 11.8584 0.750254 10.3234C0.750254 8.78838 2.96249 7.54401 5.69142 7.54401C8.42036 7.54401 10.6326 8.78838 10.6326 10.3234Z"
          stroke="white"
          strokeOpacity={0.3}
          strokeWidth={1.5}
        />
      </G>
      <G transform="translate(6 3)">
        <Path
          d="M7.11908 7.1186C8.87772 7.1186 10.3034 5.69294 10.3034 3.9343C10.3034 2.17566 8.87772 0.75 7.11908 0.75C5.36044 0.75 3.93478 2.17566 3.93478 3.9343C3.93478 5.69294 5.36044 7.1186 7.11908 7.1186Z"
          fill="#333333"
          stroke="white"
          strokeOpacity={0.7}
          strokeWidth={1.5}
        />
        <Path
          d="M13.4874 13.0892C13.4874 15.0677 13.4874 16.6715 7.11879 16.6715C0.750184 16.6715 0.750184 15.0677 0.750184 13.0892C0.750184 11.1107 3.6015 9.50683 7.11879 9.50683C10.6361 9.50683 13.4874 11.1107 13.4874 13.0892Z"
          fill="#333333"
          stroke="white"
          strokeOpacity={0.7}
          strokeWidth={1.5}
        />
      </G>
      <G transform="translate(12 0)">
        <Path
          d="M8.32696 8.32644C10.4191 8.32644 12.1152 6.6304 12.1152 4.53822C12.1152 2.44604 10.4191 0.75 8.32696 0.75C6.23478 0.75 4.53874 2.44604 4.53874 4.53822C4.53874 6.6304 6.23478 8.32644 8.32696 8.32644Z"
          fill="#333333"
          stroke="white"
          strokeWidth={1.5}
        />
        <Path
          d="M15.903 15.4293C15.903 17.783 15.903 19.691 8.32659 19.691C0.750145 19.691 0.750145 17.783 0.750145 15.4293C0.750145 13.0755 4.14223 11.1675 8.32659 11.1675C12.511 11.1675 15.903 13.0755 15.903 15.4293Z"
          fill="#333333"
          stroke="white"
          strokeWidth={1.5}
        />
      </G>
    </Svg>
  </IconBadge>
);

export const YieldBoostIcon = ({ size = 50 }: { size?: number }) => (
  <IconBadge size={size}>
    <Svg width={size} height={(size / 50) * 49.0566} viewBox="0 0 50 49.0566" fill="none">
      <Path
        d={YIELD_BOOST_PATH}
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </IconBadge>
);

/** The subscription card's icon is its own rate, set in the badge. */
export const SubscriptionIcon = ({ rate, size = 50 }: { rate: string; size?: number }) => (
  <IconBadge size={size}>
    <Text className="text-base font-medium text-white">{rate}</Text>
  </IconBadge>
);
