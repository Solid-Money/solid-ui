import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { X } from 'lucide-react-native';

import ApplePayCircle from '@/assets/images/apple-pay-circle';
import FaceScan from '@/assets/images/face-scan';
import FundDollar from '@/assets/images/fund-dollar';
import AddToWalletModal from '@/components/Card/AddToWalletModal';
import CardWaitingModal from '@/components/Home/CardWaitingModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DEPOSIT_MODAL } from '@/constants/modals';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';
import { track } from '@/lib/analytics';
import { useDepositStore } from '@/store/useDepositStore';
import {
  HomePromptKey,
  homePromptSnoozeDays,
  useHomePromptStore,
} from '@/store/useHomePromptStore';

// Figma: Mona Sans / Bold 700 / 18px / line-height 100%.
const TITLE_STYLE = { fontFamily: 'MonaSans_700Bold', fontSize: 18, lineHeight: 18 } as const;

const CONTENT: Record<
  HomePromptKey,
  { title: string; description: string; cta: string; icon: React.ReactNode }
> = {
  // Figma 20048:2924
  verification: {
    title: 'Finish verification',
    description: '2 minutes and your Visa card is ready',
    cta: 'Get verified',
    icon: <FaceScan />,
  },
  // Figma 20048:3453
  fund: {
    title: 'Fund your wallet',
    description: 'Add funds to start spending with your card',
    cta: 'Fund your wallet',
    icon: <FundDollar />,
  },
  // Figma 20964:5653
  'apple-pay': {
    title: 'Add to Apple Pay',
    description: 'To pay with your phone',
    cta: 'Add to Apple Pay',
    icon: <ApplePayCircle />,
  },
};

interface HomePromptCardProps {
  /** Which prompt to show — resolved by `useHomePrompt`. */
  promptKey: HomePromptKey;
  /** Whether the user has already funded their account (deposit step). */
  depositCompleted: boolean;
  className?: string;
}

/**
 * Next-step prompt card on the redesigned home screen. Which of the three
 * variants shows is decided by `useHomePrompt` from the user's state: an
 * abandoned KYC ("Finish verification"), card but no funds ("Fund your
 * wallet"), or a funded card that isn't in Apple Pay yet ("Add to Apple Pay").
 *
 * Each variant can be dismissed with the ✕; the dismissal is a snooze persisted
 * on the device, so it reappears once the variant's window is up — a week for
 * verification (see `useHomePromptStore`). Separate from the legacy
 * HomeCardSetup so the public/legacy home is unaffected.
 */
const HomePromptCard = ({ promptKey, depositCompleted, className }: HomePromptCardProps) => {
  const [isWaitingOpen, setIsWaitingOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const { firstIncomplete } = useHomeSetupSteps(depositCompleted);
  const dismiss = useHomePromptStore(state => state.dismiss);
  const { data: cardStatus } = useCardStatus();

  const { title, description, cta, icon } = CONTENT[promptKey];

  const onPressDismiss = () => {
    // Which prompt was closed, how long that buys, and where the user was in the
    // funnel — enough to tell "snoozed a nudge they'd already acted on" from
    // "gave up on verification" without an event per variant.
    track(TRACKING_EVENTS.HOME_PROMPT_DISMISSED, {
      prompt: promptKey,
      snoozeDays: homePromptSnoozeDays(promptKey),
      kycStatus: cardStatus?.kycStatus,
      rainApplicationStatus: cardStatus?.rainApplicationStatus,
      depositCompleted,
    });
    dismiss(promptKey);
  };

  const onPressCta = () => {
    switch (promptKey) {
      case 'verification':
        setIsWaitingOpen(true);
        break;
      case 'fund':
        useDepositStore.getState().setModal(DEPOSIT_MODAL.OPEN_OPTIONS);
        break;
      case 'apple-pay':
        setIsWalletOpen(true);
        break;
    }
  };

  return (
    <>
      <View className={className}>
        <View className="overflow-hidden rounded-twice bg-card p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1 pr-4">
              <Text className="text-foreground" style={TITLE_STYLE}>
                {title}
              </Text>
              <Text className="text-sm leading-tight text-muted-foreground">{description}</Text>
              <Button
                variant="brand"
                size="sm"
                className="mt-4 h-[35px] self-start rounded-full px-4"
                onPress={onPressCta}
              >
                <Text className="text-base font-semibold text-primary-foreground">{cta}</Text>
              </Button>
            </View>
            {/* Figma sits the art ~45px in from the card edge; the card's own
                20px padding covers most of that. */}
            <View className="mr-6">{icon}</View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Dismiss ${title}`}
            onPress={onPressDismiss}
            hitSlop={16}
            className="absolute right-[10px] top-[11px]"
          >
            <X size={24} color="rgba(255,255,255,0.5)" strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {promptKey === 'verification' && (
        <CardWaitingModal
          isOpen={isWaitingOpen}
          onClose={() => setIsWaitingOpen(false)}
          firstIncomplete={firstIncomplete}
        />
      )}

      {promptKey === 'apple-pay' && (
        <AddToWalletModal isOpen={isWalletOpen} onOpenChange={setIsWalletOpen} trigger={null} />
      )}
    </>
  );
};

export default HomePromptCard;
