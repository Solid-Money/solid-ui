import { Pressable, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';

import CashbackDetailsSheet from './CashbackDetailsSheet';

import type { CashbackDetailsData } from './CashbackDetailsSheet.types';

const CashbackIcon = () => (
  <View className="h-[49px] w-[50px] items-center justify-center rounded-full bg-white/10">
    <Svg width={26.6729} height={26.2073} viewBox="0 0 26.6729 26.2073" fill="none">
      <Path
        d="M5.11214 7.72426H2.37071M5.11214 18.4831H2.37071M5.11214 13.1037H1M6.48286 3.03819C8.44311 1.75079 10.8005 1 13.3364 1C20.1497 1 25.6729 6.419 25.6729 13.1037C25.6729 19.7884 20.1497 25.2073 13.3364 25.2073C10.8005 25.2073 8.44311 24.4565 6.48286 23.1692M16.0779 9.74141C15.3925 9.57462 14.2755 9.56849 13.3364 9.57462M13.3364 9.57462C13.0224 9.57668 13.2122 9.56358 12.7881 9.57462C11.6814 9.6085 10.5972 10.0598 10.595 11.3384C10.5926 12.7005 11.9657 13.1035 13.3364 13.1035C14.7071 13.1035 16.0779 13.4145 16.0779 14.8686C16.0779 15.9615 14.971 16.4404 13.5915 16.5989C13.5031 16.5989 13.4183 16.5991 13.3364 16.5995M13.3364 9.57462V7.72426M13.3364 16.5995C12.4041 16.6032 11.8551 16.6202 10.595 16.4657M13.3364 16.5995V18.4831"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const ReferralsIcon = () => (
  <View className="h-[49px] w-[50px] items-center justify-center rounded-full bg-white/10">
    <Svg width={28} height={21} viewBox="0 0 28 21" fill="none">
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
  </View>
);

const SupportIcon = () => (
  <View className="h-[49px] w-[50px] items-center justify-center rounded-full bg-white/10">
    <Svg width={22.5} height={20.1667} viewBox="0 0 22.5 20.1667" fill="none">
      <Path
        d="M15.9167 5.41667H20.5833C21.2277 5.41667 21.75 5.93901 21.75 6.58333V19.4167L17.8615 16.1862C17.6521 16.0121 17.3876 15.9167 17.1152 15.9167H7.75C7.10566 15.9167 6.58333 15.3943 6.58333 14.75V11.25M15.9167 5.41667V1.91667C15.9167 1.27234 15.3943 0.75 14.75 0.75H1.91667C1.27234 0.75 0.75 1.27234 0.75 1.91667V14.7503L4.63851 11.5193C4.84798 11.3453 5.11245 11.25 5.38477 11.25H6.58333M15.9167 5.41667V10.0833C15.9167 10.7277 15.3943 11.25 14.75 11.25H6.58333"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const FIXED_BENEFITS = [
  {
    title: 'Cashback',
    Icon: CashbackIcon,
    titleClassName: 'font-medium',
    titleMargin: 'mt-[21px]',
  },
  {
    title: 'Referrals',
    Icon: ReferralsIcon,
    titleClassName: 'font-bold',
    titleMargin: 'mt-[23px]',
  },
  {
    title: 'Standard Support',
    Icon: SupportIcon,
    titleClassName: 'font-bold',
    titleMargin: 'mt-3',
  },
] as const;

const BenefitCard = ({
  benefit,
  onPress,
}: {
  benefit: (typeof FIXED_BENEFITS)[number];
  onPress?: () => void;
}) => {
  const { Icon } = benefit;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      className="h-[136px] flex-1 items-center rounded-twice bg-card pt-[21px] transition-all active:scale-95 active:opacity-80"
    >
      <Icon />
      <Text
        className={`w-[98px] text-center text-base leading-4 text-white ${benefit.titleClassName} ${benefit.titleMargin}`}
        numberOfLines={2}
      >
        {benefit.title}
      </Text>
    </Pressable>
  );
};

interface DailyBenefitsProps extends CashbackDetailsData {
  onGetMoreCashback: () => void;
  onReferralsPress: () => void;
  onSupportPress: () => void;
}

/**
 * Fixed reward benefits shown for every tier.
 */
const DailyBenefits = ({
  onGetMoreCashback,
  onReferralsPress,
  onSupportPress,
  ...cashbackData
}: DailyBenefitsProps) => {
  const [cashbackBenefit, referralsBenefit, supportBenefit] = FIXED_BENEFITS;

  return (
    <View className="gap-[15px] px-4">
      <Text className="text-base font-normal text-white/50">Your tier benefits</Text>
      <View className="flex-row gap-[15px]">
        <CashbackDetailsSheet
          trigger={<BenefitCard benefit={cashbackBenefit} />}
          {...cashbackData}
          onGetMoreCashback={onGetMoreCashback}
        />
        <BenefitCard benefit={referralsBenefit} onPress={onReferralsPress} />
        <BenefitCard benefit={supportBenefit} onPress={onSupportPress} />
      </View>
    </View>
  );
};

export default DailyBenefits;
