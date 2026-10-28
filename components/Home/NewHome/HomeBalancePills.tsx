import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BalancePillRow } from '@/components/BalanceHeadline';
import CardCreditSheet from '@/components/CardCredit/CardCreditSheet';
import { ReferIcon } from '@/components/Referral/v4/ReferV4Primitives';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardCredit } from '@/hooks/useCardCredit';
import { track } from '@/lib/analytics';
import { cardCreditPillLabel, dailyYieldPillLabel, showsCardCreditPill } from '@/lib/cardCredit';

interface HomeBalancePillsProps {
  /** The day's estimated yield on what the user holds (`usePortfolio().dailyYield`). */
  dailyYield: number | undefined;
  /** The balance's currency symbol, which `dailyYield` is already in. */
  yieldSymbol?: string;
  /**
   * Card credit can only be spent with a Wirex card, so it is only fetched for
   * Wirex cardholders — for everyone else there is nothing the pill could open.
   */
  canHaveCardCredit: boolean;
}

/**
 * The pills under the Home balance (Figma 29602:13516): "+$0.35 today" while
 * savings are earning, and "$10 card credit" while there is credit to spend.
 *
 * Card credit sits here, beside the balance, and is never added into it: it
 * can only be spent with the card, so a balance that counted it would promise
 * money the user cannot send, swap or withdraw. A failed card credit read just
 * leaves the pill out.
 */
const HomeBalancePills = ({
  dailyYield,
  yieldSymbol,
  canHaveCardCredit,
}: HomeBalancePillsProps) => {
  const { data: credit } = useCardCredit({ enabled: canHaveCardCredit });
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const todayLabel = dailyYieldPillLabel(dailyYield, yieldSymbol);
  const showCredit = canHaveCardCredit && showsCardCreditPill(credit);

  const openCardCredit = useCallback(() => {
    if (!credit) return;
    track(TRACKING_EVENTS.CARD_CREDIT_PILL_TAPPED, { availableUsd: credit.availableUsd });
    track(TRACKING_EVENTS.CARD_CREDIT_SHEET_VIEWED, {
      availableUsd: credit.availableUsd,
      pendingUsd: credit.pendingUsd,
    });
    setIsSheetOpen(true);
  }, [credit]);

  if (!todayLabel && !showCredit) return null;

  return (
    <BalancePillRow>
      <View className="flex-row flex-wrap items-center justify-center gap-2 px-4 pt-[6px]">
        {todayLabel ? (
          <View className="h-[35px] justify-center rounded-full bg-card px-[14px]">
            <Text className="text-[16px] leading-[18px] text-brand">{todayLabel}</Text>
          </View>
        ) : null}
        {showCredit && credit ? (
          <Pressable
            onPress={openCardCredit}
            accessibilityRole="button"
            accessibilityLabel={`${cardCreditPillLabel(credit.availableUsd)}. What is card credit?`}
            className="h-[35px] flex-row items-center gap-1.5 rounded-full bg-card pl-3 pr-[14px] active:opacity-70 web:hover:bg-card-hover"
          >
            <ReferIcon asset="images/referral-v4/gift-16.svg" size={16} />
            <Text className="text-[16px] leading-[18px] text-white">
              {cardCreditPillLabel(credit.availableUsd)}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {credit ? (
        <CardCreditSheet isOpen={isSheetOpen} onOpenChange={setIsSheetOpen} credit={credit} />
      ) : null}
    </BalancePillRow>
  );
};

export default HomeBalancePills;
