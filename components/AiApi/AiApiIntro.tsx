import { useId } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bot, KeyRound } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { type AssetPath, getAsset } from '@/lib/assets';

import {
  formatAiApiCashback,
  formatAiApiLimit,
  formatAiApiRate,
  formatAiApiUsd,
} from './aiApiFormat';
import AiApiHeroOrbit from './AiApiHeroOrbit';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiInfoRow } from './AiApiPrimitives';

interface Agent {
  label: string;
  /** The logo tile's fill, top to bottom. */
  colors: readonly [string, string, ...string[]];
  /** The agent's mark; without one, the tile shows a bot for the user's own agent. */
  mark?: { asset: AssetPath; size: number };
}

const AGENTS: Agent[] = [
  {
    label: 'Claude Code',
    colors: ['#D97757', '#D97757'],
    mark: { asset: 'images/ai-api/agent-claude-code.svg', size: 19 },
  },
  {
    label: 'Codex',
    colors: ['#B1A7FF', '#7A9DFF', '#3941FF'],
    mark: { asset: 'images/ai-api/agent-codex.svg', size: 18 },
  },
  {
    label: 'OpenClaw',
    colors: ['#FF4D4D', '#991B1B'],
    mark: { asset: 'images/ai-api/agent-openclaw.svg', size: 20 },
  },
  {
    label: 'Hermes',
    colors: ['#000000', '#000000'],
    mark: { asset: 'images/ai-api/agent-hermes.svg', size: 22 },
  },
  {
    label: 'OpenCode',
    colors: ['#000000', '#000000'],
    mark: { asset: 'images/ai-api/agent-opencode.svg', size: 16 },
  },
  { label: 'Your own agent', colors: [AI_API_BRAND, AI_API_BRAND] },
];

/** An agent's logo: its colour, a white sheen from the top, a hairline edge, its mark. */
const AgentLogo = ({ agent }: { agent: Agent }) => (
  <LinearGradient colors={agent.colors} style={styles.agentLogo}>
    <LinearGradient
      colors={['rgba(255, 255, 255, 0.22)', 'rgba(255, 255, 255, 0)']}
      locations={[0, 0.6]}
      style={StyleSheet.absoluteFill}
    />
    <View className="absolute inset-0 rounded-2xl border border-white/[0.12]" />
    {agent.mark ? (
      <Image
        source={getAsset(agent.mark.asset)}
        style={{ width: agent.mark.size, height: agent.mark.size }}
        contentFit="contain"
      />
    ) : (
      <Bot size={18} color="#111111" strokeWidth={1.36} />
    )}
  </LinearGradient>
);

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
  cashbackTier,
  cashbackMonthlyCapUsd,
  settlementDays,
  modelCount,
  ctaLabel = 'Get API key',
  onCta,
  isCtaLoading,
}: {
  cashbackRate: number;
  /** The user's tier, whose rate and cap these are: Core, Prime or Ultra. */
  cashbackTier: string;
  /** That tier's monthly AI cashback cap, USD. 0 means no cap. */
  cashbackMonthlyCapUsd: number;
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
      <View className="overflow-hidden rounded-3xl bg-card pb-7">
        <HeroGlow />
        <AiApiHeroOrbit />
        <View className="items-center px-6 pb-[7px] pt-0.5">
          <Text className="text-[64px] font-semibold leading-[68px] text-white">{rate}</Text>
          <Text className="text-center text-[22px] font-semibold leading-7 text-white">
            cashback to run your agents
          </Text>
          <Text className="mt-4 text-center text-[15px] leading-[21px] text-white/65">
            {modelCount > 1
              ? `Get an API key for ${modelCount} AI models. `
              : 'Get an API key for top AI models. '}
            Pay as you go from your Wallet and get {cashbackRate === 0.5 ? 'half' : rate} of it
            back.
          </Text>
        </View>
      </View>

      <View className="gap-2.5">
        <Text className="text-[14px] text-white/55">Works with</Text>
        {/* Runs to the screen's edges, so it reads as a strip that scrolls. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-4"
          contentContainerClassName="gap-2 px-4"
        >
          {AGENTS.map(agent => (
            <View
              key={agent.label}
              className="flex-row items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3.5"
            >
              <AgentLogo agent={agent} />
              <Text className="text-[14px] font-medium text-white">{agent.label}</Text>
            </View>
          ))}
        </ScrollView>
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
        Your {cashbackTier} tier gets {rate} back
        {cashbackMonthlyCapUsd > 0
          ? `, up to ${formatAiApiLimit(cashbackMonthlyCapUsd)} a month`
          : ''}
        . Cashback is credited {settlementDays} days after each charge, into USD Yield. Keys are
        issued through AntSeed, an open market for AI models.
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

const styles = StyleSheet.create({
  agentLogo: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: 16,
  },
});

export default AiApiIntro;
