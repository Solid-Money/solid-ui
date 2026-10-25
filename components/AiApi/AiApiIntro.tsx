import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Bot, KeyRound, Terminal } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import {
  formatAiApiCashback,
  formatAiApiLimit,
  formatAiApiRate,
  formatAiApiUsd,
} from './aiApiFormat';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiIconTile, AiApiInfoRow } from './AiApiPrimitives';

const AGENTS: { label: string; own?: boolean }[] = [
  { label: 'Claude Code' },
  { label: 'Codex' },
  { label: 'OpenClaw' },
  { label: 'Hermes' },
  { label: 'OpenCode' },
  { label: 'Your own agent', own: true },
];

/** The example the intro prices: a round number, so the halving reads at a glance. */
const EXAMPLE_SPEND_USD = 100;

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
  settlementDays,
  modelCount,
  ctaLabel = 'Get API key',
  onCta,
  isCtaLoading,
}: {
  cashbackRate: number;
  settlementDays: number;
  modelCount: number;
  ctaLabel?: string;
  onCta?: () => void;
  isCtaLoading?: boolean;
}) => {
  const rate = formatAiApiRate(cashbackRate);
  const cashbackUsd = EXAMPLE_SPEND_USD * cashbackRate;

  return (
    <View className="w-full gap-5 px-4">
      <View className="items-center gap-2.5 overflow-hidden rounded-3xl bg-card px-6 py-7">
        <HeroGlow />
        <AiApiIconTile size={64} tone="brand">
          <Bot size={30} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
        </AiApiIconTile>
        <Text className="mt-1 text-[64px] font-semibold leading-[68px] text-brand">{rate}</Text>
        <Text className="text-center text-[22px] font-semibold text-white">
          cashback to run your agents
        </Text>
        <Text className="text-center text-[15px] leading-[21px] text-white/65">
          {modelCount > 1
            ? `Get one API key for ${modelCount} AI models. `
            : 'Get one API key for top AI models. '}
          Pay as you go from your Wallet and get {cashbackRate >= 0.5 ? 'half' : rate} of it back.
        </Text>
      </View>

      <View className="gap-2.5">
        <Text className="text-[14px] text-white/55">Works with</Text>
        <View className="flex-row flex-wrap gap-2">
          {AGENTS.map(agent => (
            <View
              key={agent.label}
              className="flex-row items-center gap-1.5 rounded-full bg-card px-3.5 py-2"
            >
              {agent.own ? (
                <Bot size={14} color="white" strokeWidth={AI_API_ICON_STROKE} />
              ) : (
                <Terminal size={14} color="white" strokeWidth={AI_API_ICON_STROKE} />
              )}
              <Text className="text-[14px] font-medium text-white">{agent.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="gap-[18px] rounded-twice bg-card px-4 py-[18px]">
        <Text className="text-[16px] font-semibold text-white">How it works</Text>
        {[
          {
            title: 'Get your API key',
            body: 'One key for every model. Takes a few seconds.',
          },
          {
            title: 'Plug it into your agent',
            body: 'Paste it into Claude Code, Codex, OpenClaw or your own agent. We show you how.',
          },
          {
            title: `Get ${rate} back`,
            body: `What your agents use is paid from your Wallet. ${
              cashbackRate === 0.5 ? 'Half' : rate
            } of it comes back as cashback.`,
          },
        ].map((step, index) => (
          <View key={step.title} className="flex-row items-start gap-3.5">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-[#2A2A2A]">
              <Text className="text-[14px] font-semibold text-white">{index + 1}</Text>
            </View>
            <View className="flex-1 gap-[3px]">
              <Text className="text-[15px] font-semibold text-white">{step.title}</Text>
              <Text className="text-[14px] leading-[19px] text-white/60">{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-3 rounded-twice bg-card px-4 py-[18px]">
        <Text className="text-[15px] font-semibold text-white">
          If your agents use {formatAiApiLimit(EXAMPLE_SPEND_USD)} this month
        </Text>
        <AiApiInfoRow label="Paid from your Wallet" value={formatAiApiUsd(EXAMPLE_SPEND_USD)} />
        <AiApiInfoRow
          label={`Cashback (${rate})`}
          value={formatAiApiCashback(cashbackUsd)}
          valueClassName="text-brand"
        />
        <View className="h-px bg-white/[0.08]" />
        <AiApiInfoRow
          label="What it really costs you"
          value={formatAiApiUsd(EXAMPLE_SPEND_USD - cashbackUsd)}
        />
      </View>

      <Text className="text-[12px] leading-[17px] text-white/45">
        Every tier gets {rate} back. Cashback is credited {settlementDays} days after each charge,
        into USD Yield.
      </Text>

      {onCta ? (
        <Button
          variant="brand"
          onPress={onCta}
          disabled={isCtaLoading}
          className="h-[52px] flex-row gap-2 rounded-full"
          accessibilityLabel={ctaLabel}
        >
          <KeyRound size={18} color="black" strokeWidth={AI_API_ICON_STROKE} />
          <Text className="text-[16px] font-bold text-black">{ctaLabel}</Text>
        </Button>
      ) : null}
    </View>
  );
};

export default AiApiIntro;
