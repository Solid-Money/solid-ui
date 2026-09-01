import { ReactNode, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image, ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { RowChevronIcon, SupportRowIcon } from '@/components/Card/NewCardDetails/icons';
import CopyToClipboard from '@/components/CopyToClipboard';
import { Text } from '@/components/ui/text';
import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

import { CopyFieldIcon, InfoRowIcon } from './icons';

const FLAG_SIZE = 49;
/** hsl(var(--popup)) — the sheet's own background, so the fades read as it dimming out. */
const MODAL_BACKGROUND = '#101010';
/** How far content fades under the header / above the bottom edge. */
const FADE_EXTENT = 40;

export const VIRTUAL_ACCOUNT_TERMS_URL =
  'https://support.solid.xyz/en/articles/15324239-solid-virtual-account-user-terms-of-service';

/** One label-above-value row on the details card. */
export interface BankAccountDetailRow {
  label: string;
  value: string;
}

/** One label-above-value detail row with a copy affordance (Figma 21445:3284). */
const DetailRow = ({
  label,
  value,
  withDivider = false,
  onCopy,
}: {
  label: string;
  value: string;
  withDivider?: boolean;
  onCopy?: (label: string) => void;
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
        <CopyToClipboard
          text={value}
          icon={<CopyFieldIcon />}
          className="opacity-50"
          size={18}
          onCopy={() => onCopy?.(label)}
        />
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

export interface BankAccountDetailsViewProps {
  /** Flag image for the account's currency — `getAsset('images/us.png')` etc. */
  flag: ImageSource;
  /** e.g. "Virtual USD account". */
  title: string;
  /** One line under the banknote banner explaining what the account does. */
  blurb: string;
  /** The requisites, in the order they should be read. */
  rows: BankAccountDetailRow[];
  /** Rendered between the title and the banner — the rail switcher, when there is one. */
  header?: ReactNode;
  /** Rendered under the details card, above the link rows. */
  footer?: ReactNode;
  /** Fired with the row's label when a value is copied. Never the value itself. */
  onCopyField?: (label: string) => void;
}

/**
 * The shared "here are your bank details" sheet.
 *
 * Extracted from the USD virtual-account screen (Figma 21445:3186) so the Wirex
 * EUR/USD accounts render in exactly the same visual language rather than
 * growing a second, drifting copy of it. Every measurement below is from that
 * frame; only the flag, the copy and the rows differ between accounts.
 */
export const BankAccountDetailsView = ({
  flag,
  title,
  blurb,
  rows,
  header,
  footer,
  onCopyField,
}: BankAccountDetailsViewProps) => {
  const insets = useSafeAreaInsets();
  const { isScreenMedium } = useDimension();
  const { height: windowHeight } = useWindowDimensions();
  const [isScrolled, setIsScrolled] = useState(false);

  // The modal only hands us a flex-bounded height on web and on small native screens;
  // on a native tablet it sizes to content, so the ScrollView needs its own cap there.
  const isFlexBounded = Platform.OS === 'web' || !isScreenMedium;

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
          <Image source={flag} style={styles.flag} contentFit="cover" />
          <Text className="text-center text-[20px] font-semibold text-white">{title}</Text>
        </View>

        {header}

        {/* Banknote-textured intro banner; the details card overlaps its lower half. */}
        <View style={styles.banner} className="overflow-hidden rounded-twice bg-[#323232]">
          <Image
            source={getAsset('images/dollar-bill-texture.jpg')}
            style={[StyleSheet.absoluteFill, styles.bannerTexture]}
            contentFit="cover"
          />
          <Text className="text-[16px] leading-5 text-white/70">{blurb}</Text>
        </View>

        <View style={styles.detailsCard} className="overflow-hidden rounded-twice bg-card">
          {rows.map((row, index) => (
            <DetailRow
              key={row.label}
              label={row.label}
              value={row.value}
              withDivider={index < rows.length - 1}
              onCopy={onCopyField}
            />
          ))}
        </View>

        {footer}

        <View className="gap-4 pt-4">
          <LinkRow
            icon={<InfoRowIcon />}
            label="More information"
            onPress={() => Linking.openURL(VIRTUAL_ACCOUNT_TERMS_URL)}
          />
          {/*
            Wrapped, not passed bare: Pressable hands onPress the press event,
            which openSupportDrawer would take as its `chatMessage` and forward
            into Intercom's composer. Carried over from qa, which fixed this on
            the inline version this component was extracted from.
          */}
          <LinkRow
            icon={<SupportRowIcon />}
            label="Contact support"
            onPress={() => openSupportDrawer()}
          />
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
