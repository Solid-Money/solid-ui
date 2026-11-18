import { useId } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyRound } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import {
  aiApiSharedTierRate,
  formatAiApiLimit,
  formatAiApiRate,
  formatAiApiTierCaps,
} from './aiApiFormat';
import AiApiHeroOrbit from './AiApiHeroOrbit';
import { AiApiIntroFaq, AiApiIntroSteps } from './AiApiIntroDetails';
import AiApiIntroModels from './AiApiIntroModels';
import { AI_API_ICON_STROKE } from './AiApiPrimitives';

import type { AiApiCashbackTier, AiApiModel } from '@/lib/types/ai-api';

const FOOTER_BACKGROUND = '#0F0F10';

export const AiApiIntroFooter = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { bottom } = useSafeAreaInsets();
  // PageLayout already applies the bottom safe area. Match the tier footer's
  // minimum spacing on devices without a bottom inset.
  const paddingBottom = Math.max(19 - bottom, 0) + 5;

  return (
    <View className="relative shrink-0 bg-background" style={{ paddingBottom }}>
      <LinearGradient
        colors={[`${FOOTER_BACKGROUND}00`, FOOTER_BACKGROUND]}
        pointerEvents="none"
        style={{ position: 'absolute', top: -32, left: 0, right: 0, height: 32 }}
      />
      <View className="mx-auto w-full max-w-lg px-4 pt-3">
        <Button
          variant="brand"
          size="sm"
          onPress={onPress}
          className="h-[52px] flex-row gap-2 rounded-full"
          accessibilityLabel={label}
        >
          <KeyRound size={18} color="black" strokeWidth={AI_API_ICON_STROKE} />
          <Text className="text-[16px] font-bold text-black">{label}</Text>
        </Button>
      </View>
    </View>
  );
};

/**
 * Figma's footnote: `Every tier gets 50% back, on top of your card cashback: up
 * to $50 a month on Core, $100 on Prime and $200 on Ultra. Cashback is
 * credited 14 days after each charge, into USD Yield.` When the tiers' rates
 * differ, or an older backend sends only the user's own, it speaks for their
 * tier alone.
 */
const cashbackFootnote = ({
  cashbackRate,
  cashbackTier,
  cashbackTiers,
  cashbackMonthlyCapUsd,
  settlementDays,
}: {
  cashbackRate: number;
  cashbackTier: string;
  cashbackTiers?: AiApiCashbackTier[];
  cashbackMonthlyCapUsd: number;
  settlementDays: number;
}): string => {
  const settles = `Cashback is credited ${settlementDays} days after each charge, into USD Yield.`;
  const sharedRate = cashbackTiers ? aiApiSharedTierRate(cashbackTiers) : null;
  if (cashbackTiers && sharedRate !== null) {
    const caps = formatAiApiTierCaps(cashbackTiers);
    return `Every tier gets ${formatAiApiRate(sharedRate)} back, on top of your card cashback${
      caps ? `: ${caps}` : ''
    }. ${settles}`;
  }
  const cap =
    cashbackMonthlyCapUsd > 0 ? `, up to ${formatAiApiLimit(cashbackMonthlyCapUsd)} a month` : '';
  return `Your ${cashbackTier} tier gets ${formatAiApiRate(
    cashbackRate,
  )} back, on top of your card cashback${cap}. ${settles}`;
};

/** The hero's green glow, centred over the icon. */
const HeroGlow = () => {
  const id = `ai-api-hero-${useId().replace(/:/g, '')}`;
  return (
    <Svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient id={id} cx="50%" cy="15%" rx="50%" ry="36%">
          <Stop offset="0" stopColor="#94F280" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#94F280" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
};

/**
 * What the AI API is, before the user has a key — and again from the
 * dashboard's "How it works", where the button goes on to a new key.
 */
const AiApiIntro = ({
  cashbackRate,
  cashbackTier,
  cashbackTiers,
  cashbackMonthlyCapUsd,
  settlementDays,
  models,
  billingTokens,
  onOpenSetup,
}: {
  cashbackRate: number;
  /** The user's tier, whose rate and cap these are: Core, Prime or Ultra. */
  cashbackTier: string;
  /** Every tier's terms, for the footnote's caps; missing on an older backend. */
  cashbackTiers?: AiApiCashbackTier[];
  /** The user's tier's monthly AI cashback cap, USD. 0 means no cap. */
  cashbackMonthlyCapUsd: number;
  settlementDays: number;
  /** The models a key can call, most used first. */
  models: AiApiModel[];
  billingTokens: string[];
  onOpenSetup: () => void;
}) => {
  const rate = formatAiApiRate(cashbackRate);

  return (
    <View className="w-full gap-5 px-4 web:[font-synthesis:none]">
      <View className="overflow-hidden rounded-3xl bg-card pb-7">
        <HeroGlow />
        <AiApiHeroOrbit />
        <View className="items-center px-6 pb-[7px] pt-0.5">
          <Text className="text-[64px] font-semibold leading-[68px] text-white">{rate}</Text>
          <Text className="text-center text-[22px] font-semibold leading-7 text-white">
            cashback to run your agents
          </Text>
          <Text className="mt-4 text-center text-[15px] leading-[21px] text-white/65">
            One API key for top AI models. Pay as you go from your Wallet and get{' '}
            {cashbackRate === 0.5 ? 'half' : rate} of it back.
          </Text>
        </View>
      </View>

      <AiApiIntroModels
        models={models}
        cashbackRate={cashbackRate}
        isCapped={cashbackMonthlyCapUsd > 0}
      />
      <AiApiIntroSteps cashbackRate={cashbackRate} onOpenSetup={onOpenSetup} />
      <AiApiIntroFaq
        cashbackRate={cashbackRate}
        cashbackMonthlyCapUsd={cashbackMonthlyCapUsd}
        settlementDays={settlementDays}
        billingTokens={billingTokens}
        onOpenSetup={onOpenSetup}
      />

      <Text className="text-[12px] leading-[17px] text-white/45">
        {cashbackFootnote({
          cashbackRate,
          cashbackTier,
          cashbackTiers,
          cashbackMonthlyCapUsd,
          settlementDays,
        })}
      </Text>
    </View>
  );
};

export default AiApiIntro;
