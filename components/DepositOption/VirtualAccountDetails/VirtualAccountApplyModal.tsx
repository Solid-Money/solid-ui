import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Globe } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { checkVaAccess, getCountryFromIp } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { RainApplicationStatus } from '@/lib/types';
import { withRefreshToken } from '@/lib/utils';
import { useDepositStore } from '@/store/useDepositStore';
import { useKycStore } from '@/store/useKycStore';

const BENEFITS_HEIGHT = 328;
const FIRST_ROW_HEIGHT = 177;
const HAIRLINE = 'rgba(255,255,255,0.1)';

interface Benefit {
  icon?: ReturnType<typeof getAsset>;
  iconHeight?: number;
  iconWidth?: number;
  label: string;
  textBadge?: string;
}

const BENEFITS: Benefit[] = [
  {
    icon: getAsset('images/virtual-account-bank.svg'),
    iconWidth: 26.5023,
    iconHeight: 23.3426,
    label: 'A persistent virtual\nbank account in\nyour name',
  },
  {
    icon: getAsset('images/virtual-account-ach-wire.svg'),
    iconWidth: 26.1729,
    iconHeight: 25.7073,
    label: 'Support for\nACH and Wire\ndeposits',
  },
  {
    icon: getAsset('images/virtual-account-settlement.svg'),
    iconWidth: 28.5,
    iconHeight: 25.5001,
    label: 'Settlement in 1-3\nbusiness days',
  },
  {
    label: 'No fees\nfrom Solid',
    textBadge: '$0',
  },
];

const BenefitCell = ({ benefit }: { benefit: Benefit }) => (
  <View className="flex-1 items-center">
    <View style={styles.badge} className="items-center justify-center bg-white/10">
      {benefit.textBadge ? (
        <Text className="text-[20px] font-normal leading-6 text-white">{benefit.textBadge}</Text>
      ) : (
        <Image
          source={benefit.icon}
          style={{ width: benefit.iconWidth, height: benefit.iconHeight }}
          contentFit="fill"
        />
      )}
    </View>
    <Text className="mt-[9px] text-center text-[16px] font-medium leading-5 text-white">
      {benefit.label}
    </Text>
  </View>
);

const BenefitsGrid = () => (
  <View style={styles.benefitsCard} className="mx-[18px] overflow-hidden bg-[#1C1C1C]">
    <View style={styles.firstBenefitRow} className="flex-row">
      <BenefitCell benefit={BENEFITS[0]} />
      <BenefitCell benefit={BENEFITS[1]} />
    </View>
    <View style={styles.secondBenefitRow} className="flex-row">
      <BenefitCell benefit={BENEFITS[2]} />
      <BenefitCell benefit={BENEFITS[3]} />
    </View>
    <View pointerEvents="none" style={styles.horizontalDivider} />
    <View pointerEvents="none" style={styles.verticalDivider} />
  </View>
);

export const VirtualAccountApplyModal = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setModal = useDepositStore(state => state.setModal);
  const setKycFlow = useKycStore(state => state.setKycFlow);
  const { data: cardStatus } = useCardStatus();

  const [isChecking, setIsChecking] = useState(false);
  const [countryNotSupported, setCountryNotSupported] = useState(false);

  // The dialog itself sits inside the overlay's 8pt inset. Adding the device's
  // safe-area plus 7pt places the hero and back button at y=59 on the Figma frame.
  const heroTop = insets.top + 7;

  const handleBack = useCallback(() => {
    setModal(DEPOSIT_MODAL.OPEN_DEPOSIT_TYPE);
  }, [setModal]);

  const proceed = useCallback(() => {
    const rainStatus = cardStatus?.rainApplicationStatus;

    if (rainStatus === RainApplicationStatus.APPROVED) {
      setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS);
      return;
    }

    setKycFlow('va');
    setModal(DEPOSIT_MODAL.CLOSE);

    if (
      rainStatus === RainApplicationStatus.NEEDS_VERIFICATION ||
      rainStatus === RainApplicationStatus.NEEDS_INFORMATION
    ) {
      router.push(path.CARD_PENDING);
      return;
    }

    router.push(path.KYC);
  }, [cardStatus, router, setKycFlow, setModal]);

  const handleApply = useCallback(async () => {
    setIsChecking(true);
    try {
      // Prefer the country from the completed KYC record; fall back to IP detection.
      const countryCode = cardStatus?.country ?? (await getCountryFromIp())?.countryCode;

      if (!countryCode) {
        // Can't determine country — let the KYC flow handle it.
        proceed();
        return;
      }

      const { hasAccess } = await withRefreshToken(() => checkVaAccess(countryCode));

      if (!hasAccess) {
        setCountryNotSupported(true);
        return;
      }

      proceed();
    } catch {
      // On any error, fall through and let the KYC flow surface the issue.
      proceed();
    } finally {
      setIsChecking(false);
    }
  }, [cardStatus, proceed]);

  if (countryNotSupported) {
    return (
      <View className="flex-1 bg-[#111] px-[18px]">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={handleBack}
          className="absolute left-[18px] z-10 h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
          style={{ top: heroTop }}
        >
          <ArrowLeft size={22} color="#fff" />
        </Pressable>

        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center justify-center rounded-full bg-[#1C1C1C] p-6">
            <Globe size={48} color="rgba(255,255,255,0.4)" />
          </View>

          <View className="items-center gap-2">
            <Text className="text-center text-2xl font-bold text-white">
              Not Available in Your Region
            </Text>
            <Text className="text-center text-base text-white/60">
              Virtual bank accounts are not yet available in your country. We&apos;re working on
              expanding access.
            </Text>
          </View>
        </View>

        <Button className="mb-6 h-14 w-full rounded-2xl bg-[#1C1C1C]" onPress={handleBack}>
          <Text className="text-base font-bold text-white">Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#111]">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 56 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: heroTop }}>
          <View style={styles.heroImage} className="w-full overflow-hidden">
            <Image
              source={getAsset('images/virtual-account-hero-v2.png')}
              style={StyleSheet.absoluteFill}
              contentFit="fill"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={handleBack}
              className="absolute left-[18px] top-0 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/10 web:hover:bg-white/15"
            >
              <ArrowLeft size={22} color="#fff" />
            </Pressable>
          </View>
        </View>

        <Text className="mt-[7px] self-center text-center text-[30px] font-medium leading-[30px] -tracking-[1px] text-white">
          USD Virtual{`\n`}bank account
        </Text>

        <Text className="mt-[6px] w-[315px] max-w-[85%] self-center text-center text-[16px] leading-5 text-white/70">
          Get a US bank account in your name so you can deposit USD straight into soUSD.
        </Text>

        <View className="mt-14">
          <BenefitsGrid />
        </View>

        <Button
          variant="brand"
          className="mx-[18px] mt-[35px] h-[51px] rounded-full border-0"
          onPress={handleApply}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-[16px] font-semibold text-black">Verify now</Text>
          )}
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  heroImage: { aspectRatio: 419 / 233 },
  benefitsCard: { height: BENEFITS_HEIGHT, borderRadius: 23 },
  firstBenefitRow: {
    height: FIRST_ROW_HEIGHT,
    paddingTop: 23,
  },
  secondBenefitRow: { height: BENEFITS_HEIGHT - FIRST_ROW_HEIGHT, paddingTop: 24 },
  horizontalDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: FIRST_ROW_HEIGHT,
    height: 1,
    backgroundColor: HAIRLINE,
  },
  verticalDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    backgroundColor: HAIRLINE,
  },
  badge: { width: 50, height: 49, borderRadius: 100 },
});
