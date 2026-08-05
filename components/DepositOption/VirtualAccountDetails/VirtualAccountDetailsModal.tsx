import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { RowChevronIcon, SupportRowIcon } from '@/components/Card/NewCardDetails/icons';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { useDimension } from '@/hooks/useDimension';
import { useOnrampAutomation } from '@/hooks/useOnrampAutomation';
import { getAsset } from '@/lib/assets';
import { useDepositStore } from '@/store/useDepositStore';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import { CopyFieldIcon, InfoRowIcon } from './icons';

const FLAG_SIZE = 49;
/** hsl(var(--popup)) — the sheet's own background, so the fades read as it dimming out. */
const MODAL_BACKGROUND = '#101010';
/** How far content fades under the header / above the bottom edge. */
const FADE_EXTENT = 40;

const MORE_INFORMATION_URL =
  'https://support.solid.xyz/en/articles/15324239-solid-virtual-account-user-terms-of-service';

/** One label-above-value detail row with a copy affordance (Figma 21445:3284). */
const DetailRow = ({
  label,
  value,
  withDivider = false,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
}) => (
  <View>
    <View className="flex-row items-center" style={styles.detailRow}>
      <View className="flex-1 gap-0.5">
        <Text className="text-[14px] leading-5 text-white/70" numberOfLines={1}>
          {label}
        </Text>
        <Text
          className="text-[16px] font-medium leading-[23px] text-white"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
      {value ? (
        <CopyToClipboard text={value} icon={<CopyFieldIcon />} className="opacity-50" size={18} />
      ) : null}
    </View>
    {withDivider && <View style={styles.divider} />}
  </View>
);

/** One full-width link card — "More information" / "Contact support" (Figma 21445:3381). */
const LinkRow = ({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={styles.linkRow}
    className="flex-row items-center rounded-twice bg-card web:hover:bg-card-hover"
  >
    <View style={styles.iconSlot}>{icon}</View>
    <Text className="flex-1 text-[16px] font-medium text-white">{label}</Text>
    <RowChevronIcon />
  </Pressable>
);

export const VirtualAccountDetailsModal = () => {
  const setModal = useDepositStore(state => state.setModal);
  const insets = useSafeAreaInsets();
  const { isScreenMedium } = useDimension();
  const { height: windowHeight } = useWindowDimensions();
  const [isScrolled, setIsScrolled] = useState(false);
  const { data: automation, isLoading } = useOnrampAutomation();

  // The modal only hands us a flex-bounded height on web and on small native screens;
  // on a native tablet it sizes to content, so the ScrollView needs its own cap there.
  const isFlexBounded = Platform.OS === 'web' || !isScreenMedium;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <ActivityIndicator />
      </View>
    );
  }

  if (!automation) {
    return (
      <View className="flex-1 items-center justify-center gap-4 py-12">
        <Text className="text-base text-white">Could not load your bank details.</Text>
        <Button
          className="h-12 rounded-2xl px-6"
          onPress={() => setModal(DEPOSIT_MODAL.OPEN_VIRTUAL_ACCOUNT_TOS)}
        >
          <Text className="text-base font-bold text-black">Try again</Text>
        </Button>
      </View>
    );
  }

  const { depositAddress } = automation;

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        style={isFlexBounded ? undefined : { maxHeight: windowHeight * 0.8 }}
        // The sheet is taller than the viewport, so the last card needs the safe area
        // plus that overhang plus the fade to stay clear of the screen edge.
        contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}
        showsVerticalScrollIndicator={false}
        onScroll={event => setIsScrolled(event.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={16}
      >
        {/* Flag + title */}
        <View className="items-center gap-2">
          <Image source={getAsset('images/us.png')} style={styles.flag} contentFit="cover" />
          <Text className="text-center text-[20px] font-semibold text-white">
            Virtual USD account
          </Text>
        </View>

        {/* Banknote-textured intro banner; the details card overlaps its lower half. */}
        <View style={styles.banner} className="overflow-hidden rounded-twice bg-[#323232]">
          <Image
            source={getAsset('images/dollar-bill-texture.jpg')}
            style={[StyleSheet.absoluteFill, styles.bannerTexture]}
            contentFit="cover"
          />
          <Text className="text-[16px] leading-5 text-white/70">
            Get bank transfers directly to your solid account with ACH and Wire
          </Text>
        </View>

        <View style={styles.detailsCard} className="overflow-hidden rounded-twice bg-card">
          <DetailRow label="Beneficiary name" value={depositAddress.beneficiaryName} withDivider />
          <DetailRow
            label="Beneficiary address"
            value={depositAddress.beneficiaryAddress}
            withDivider
          />
          <DetailRow label="Bank name" value={depositAddress.beneficiaryBankName} withDivider />
          <DetailRow
            label="Bank address"
            value={depositAddress.beneficiaryBankAddress}
            withDivider
          />
          <DetailRow label="Account number" value={depositAddress.accountNumber} withDivider />
          <DetailRow label="Routing number" value={depositAddress.routingNumber} />
        </View>

        <View className="gap-4 pt-4">
          <LinkRow
            icon={<InfoRowIcon />}
            label="More information"
            onPress={() => Linking.openURL(MORE_INFORMATION_URL)}
          />
          <LinkRow icon={<SupportRowIcon />} label="Contact support" onPress={openSupportDrawer} />
        </View>
      </ScrollView>

      {/* Content fades out under the header and above the bottom edge instead of
          getting a hard clip, matching the card-waiting modal's treatment. The top
          fade only appears once something has scrolled up into it. */}
      {isScrolled && (
        <LinearGradient
          colors={[MODAL_BACKGROUND, `${MODAL_BACKGROUND}00`]}
          pointerEvents="none"
          style={[styles.fade, { top: 0, height: FADE_EXTENT }]}
        />
      )}
      <LinearGradient
        colors={[`${MODAL_BACKGROUND}00`, MODAL_BACKGROUND]}
        pointerEvents="none"
        style={[styles.fade, { bottom: 0, height: insets.bottom + FADE_EXTENT }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flag: { width: FLAG_SIZE, height: FLAG_SIZE, borderRadius: FLAG_SIZE / 2 },
  fade: { position: 'absolute', left: 0, right: 0 },
  // Figma: 137pt banner starting 28 below the title, with the details card laid over
  // its bottom 50pt so only the copy and a sliver of texture stay visible.
  banner: { height: 137, marginTop: 28, paddingTop: 23, paddingHorizontal: 22 },
  // Figma blends the banknote photo at soft-light 20%; RN has no cross-platform
  // blend mode, so the plain 20% wash over #323232 stands in for it.
  bannerTexture: { opacity: 0.2 },
  detailsCard: { marginTop: -50 },
  // Rows are 81pt tall with the text block at x=21; the 40pt copy button's own
  // padding makes up the rest of the 24.5pt gap to the card's right edge.
  detailRow: { paddingLeft: 21, paddingRight: 14, paddingVertical: 18 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.1)', height: 1 },
  // 66pt link cards with the label at x=66 and the chevron 25 from the right edge.
  linkRow: { paddingLeft: 26, paddingRight: 24, paddingVertical: 21 },
  iconSlot: { alignItems: 'center', marginRight: 16, width: 24 },
});
