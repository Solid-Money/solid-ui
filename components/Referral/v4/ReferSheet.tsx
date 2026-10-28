import { type ReactNode } from 'react';
import { View } from 'react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';

import { ReferSheetClose } from './ReferV4Primitives';

/** Figma's sheet padding: 16 above the close control, 24 at the sides, 36 below. */
const SHEET_TOP = 16;
const SHEET_SIDES = 24;
const SHEET_BOTTOM = 36;

interface ReferSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Distinguishes this sheet in `ResponsiveModal`'s bookkeeping on desktop. */
  contentKey: string;
  children: ReactNode;
}

/**
 * The sheet every referral v4 surface opens in: the app's shared card sheet
 * (Gorhom on native, a bottom sheet on phone web, a dialog from `md` up) with
 * the referral sheets' own close row and centred column (Figma 29591:13373).
 *
 * The app's sheet keeps its own surface and corner radius where Figma's
 * differ — the contract asks for the existing sheet styling to win.
 */
const ReferSheet = ({ isOpen, onOpenChange, contentKey, children }: ReferSheetProps) => (
  <CardBottomSheet
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    contentKey={contentKey}
    designTop={SHEET_TOP}
    designBottom={SHEET_BOTTOM}
    // Friend lists and the rules can outgrow a small phone.
    scrollable
  >
    {({ topPadding, presentation }) => (
      <View
        className="w-full items-center"
        style={{
          paddingTop: topPadding,
          paddingHorizontal: presentation === 'modal' ? 0 : SHEET_SIDES,
        }}
      >
        <ReferSheetClose onPress={() => onOpenChange(false)} />
        {children}
      </View>
    )}
  </CardBottomSheet>
);

export default ReferSheet;
