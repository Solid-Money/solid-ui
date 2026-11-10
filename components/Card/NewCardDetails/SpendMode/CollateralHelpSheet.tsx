import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import {
  type CardSheetPresentation,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

/** Where the title starts, measured from the sheet's top edge (Figma 30709:15271). */
const COLLATERAL_HELP_SHEET_TOP = 37;
/** Figma leaves 34 under the button, before any safe-area inset. */
const COLLATERAL_HELP_SHEET_BOTTOM = 34;

const STEPS = [
  {
    key: 'ltv',
    icon: getAsset('images/collateral-help-ltv.svg'),
    title: 'Each asset has an LTV',
    body: 'The share of its value you can borrow, minus a small safety buffer.',
  },
  {
    key: 'locked',
    icon: getAsset('images/collateral-help-locked.svg'),
    title: 'Only what you spend is locked',
    body: 'Locked USD and EUR Yield keep earning. Repaying unlocks it.',
  },
  {
    key: 'sell-point',
    icon: getAsset('images/collateral-help-sell-point.svg'),
    title: 'Stay below the sell point',
    body: 'If your loan reaches it, some collateral is sold to repay it. You’ll get a warning first.',
  },
] as const;

interface CollateralHelpSheetContentProps {
  onDismiss: () => void;
  topPadding: number;
  presentation?: CardSheetPresentation;
}

/** The body of "How collateral works" (Figma 30709:15271). */
export const CollateralHelpSheetContent = ({
  onDismiss,
  topPadding,
  presentation,
}: CollateralHelpSheetContentProps) => (
  <View style={{ paddingHorizontal: sheetBodyInset(presentation), paddingTop: topPadding }}>
    <Text className="text-center text-[24px] font-semibold leading-[34px] text-white">
      How collateral works
    </Text>
    <Text
      className="text-center text-[16px] font-normal leading-[22px] text-white/70"
      style={styles.intro}
    >
      Your assets back what you spend on Credit, so you don&apos;t have to sell them.
    </Text>

    <View style={styles.steps}>
      {STEPS.map(step => (
        <View key={step.key} style={styles.step}>
          <View accessible={false} style={styles.stepIcon}>
            <Image source={step.icon} style={styles.stepGlyph} />
          </View>
          <View style={styles.stepText}>
            <Text className="text-[16px] font-medium leading-[23px] text-white">{step.title}</Text>
            <Text className="text-[14px] font-normal leading-[20px] text-white/60">
              {step.body}
            </Text>
          </View>
        </View>
      ))}
    </View>

    <Button
      variant="brand"
      size="lg"
      onPress={onDismiss}
      className="w-full rounded-full bg-brand"
      style={styles.action}
    >
      <Text className="text-[16px] font-semibold text-black">Got it</Text>
    </Button>
  </View>
);

interface CollateralHelpSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "How collateral works", from the "?" beside "Collateral assets" on the spend-mode sheet's
 * Credit panel. It opens over that sheet rather than replacing it, so "Got it" lands the
 * cardholder back on the panel they asked from.
 */
const CollateralHelpSheet = ({ isOpen, onOpenChange }: CollateralHelpSheetProps) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey="collateral-help"
    designTop={COLLATERAL_HELP_SHEET_TOP}
    designBottom={COLLATERAL_HELP_SHEET_BOTTOM}
    stackBehavior="push"
    // About 500pt with the safe area: scrolls rather than clips on the smallest phones.
    scrollable
  >
    {({ topPadding, presentation }) => (
      <CollateralHelpSheetContent
        onDismiss={() => onOpenChange(false)}
        topPadding={topPadding}
        presentation={presentation}
      />
    )}
  </CardBottomSheet>
);

const styles = StyleSheet.create({
  intro: { marginTop: 8 },
  // Figma 30709:15301: two 20pt spacers above the steps, 16 between them.
  steps: { gap: 16, marginTop: 40 },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: 14 },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  stepGlyph: { height: 20, width: 20 },
  stepText: { flex: 1, gap: 4 },

  action: { height: 50, marginTop: 20 },
});

export default CollateralHelpSheet;
