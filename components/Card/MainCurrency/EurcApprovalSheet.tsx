import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { TickIcon } from '@/components/Card/MainCurrency/icons';
import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

const EURC_LOGO = getAsset('images/eurc.png');

/** Figma 29236:10588: 15 handle padding, the 5pt grabber, then 16 + 8 + 16 to the logo. */
const SHEET_TOP = 60;
/** Figma 29236:10588: 40 below "Not now". */
const SHEET_BOTTOM = 40;

const POINTS = [
  'EURC stays in your wallet until you pay',
  'You only do this once',
  'Change your main currency anytime',
];

interface EurcApprovalSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: () => void;
  isApproving: boolean;
  error?: string;
}

/**
 * The one-time approval behind the first switch to Euro (Figma 29236:10588): lets the card pay
 * with EURC, by enabling the spend module on Base with the cardholder's passkey.
 */
const EurcApprovalSheet = ({
  isOpen,
  onOpenChange,
  onApprove,
  isApproving,
  error,
}: EurcApprovalSheetProps) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={open => {
      // Not dismissable mid-approval: the user operation is already in flight.
      if (!open && isApproving) return;
      onOpenChange(open);
    }}
    contentKey="eurc-approval"
    designTop={SHEET_TOP}
    designBottom={SHEET_BOTTOM}
  >
    {({ topPadding, presentation }) => (
      <View
        style={[
          styles.body,
          { paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) },
        ]}
      >
        <Image source={EURC_LOGO} style={styles.logo} />
        <Text className="mt-4 text-center text-[26px] font-medium text-white">
          Let your card pay with EURC
        </Text>
        <Text
          className={`mt-4 text-center text-[16px] ${error ? 'text-red-400' : 'text-white/70'}`}
          style={styles.description}
        >
          {error ??
            'One approval with your passkey. After that, euro purchases come out of your EURC with no FX fee.'}
        </Text>

        <View style={styles.points}>
          {POINTS.map(point => (
            <View key={point} style={styles.point}>
              <TickIcon fillOpacity={0.18} />
              <Text className="text-[16px] text-white">{point}</Text>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Approve with passkey"
          accessibilityState={{ disabled: isApproving, busy: isApproving }}
          // Disabled in flight: a second press would build a second batch against a Safe the first
          // is already registering, and the repeat `registerSafe` reverts.
          disabled={isApproving}
          onPress={onApprove}
          className="bg-white transition-all active:scale-95 active:opacity-80 disabled:opacity-60"
          style={styles.approve}
        >
          {isApproving ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text className="text-[16px] font-semibold text-black">Approve with passkey</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          disabled={isApproving}
          onPress={() => onOpenChange(false)}
          className="mt-4 web:hover:opacity-70"
        >
          <Text className="text-[16px] font-semibold text-white/70">Not now</Text>
        </Pressable>
      </View>
    )}
  </CardBottomSheet>
);

const styles = StyleSheet.create({
  body: { alignItems: 'center' },
  logo: { borderRadius: 16, height: 64, width: 64 },
  description: { maxWidth: 340 },
  // Figma: 16 gap + a 4pt spacer + 16 gap above the box.
  points: {
    alignSelf: 'stretch',
    backgroundColor: '#2B2B2B',
    borderRadius: 20,
    gap: 14,
    marginTop: 36,
    padding: 20,
  },
  point: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  // Figma: 16 gap + an 8pt spacer + 16 gap above the button.
  approve: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 100,
    height: 50,
    justifyContent: 'center',
    marginTop: 40,
  },
});

export default EurcApprovalSheet;
