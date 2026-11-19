import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ArrowUpRight, Check } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';
import { cn } from '@/lib/utils';

import { formatAiApiBillingFunds, formatAiApiLimit, formatAiApiRate } from './aiApiFormat';
import AiApiIntroDisclosure from './AiApiIntroDisclosure';
import { ANTSEED_DOCS_URL } from './aiApiLinks';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiIntroChevron } from './AiApiPrimitives';

const ANTSEED_POINTS = [
  'One price per model, set by Solid',
  'We don’t store your prompts or answers',
  'Only usage is kept, for billing',
];

const IntroLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable
    accessibilityRole="link"
    onPress={onPress}
    hitSlop={4}
    className="flex-row items-center gap-1.5 self-start active:opacity-70"
  >
    <Text className="text-[14px] font-medium leading-5 text-white">{label}</Text>
    <ArrowUpRight size={14} color="white" strokeWidth={AI_API_ICON_STROKE} />
  </Pressable>
);

const SetupLink = ({ onPress }: { onPress: () => void }) => (
  <IntroLink label="See setup guides" onPress={onPress} />
);

const AntseedRow = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="gap-3.5 border-t border-white/[0.07] pt-[18px]">
      <Pressable
        accessibilityRole="button"
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
        className="flex-row items-center gap-3 active:opacity-70"
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/[0.12]">
          <Image
            source={getAsset('images/ai-api/antseed-ant.svg')}
            style={{ width: 36, height: 36 }}
            contentFit="contain"
          />
        </View>
        <View className="flex-1 gap-px">
          <Text className="text-[16px] font-semibold leading-5 text-white">Powered by Antseed</Text>
          <Text className="text-[13px] leading-[17px] text-white/50">
            An open market for AI models
          </Text>
        </View>
        <AiApiIntroChevron expanded={expanded} />
      </Pressable>
      {expanded ? (
        <>
          <Text className="text-[14px] leading-5 text-white/70">
            Your requests run on Antseed’s network of AI providers. Solid sets one price for each
            model, whichever provider serves it, and adjusts it as Antseed’s market rates move.
          </Text>
          <View className="gap-2.5">
            {ANTSEED_POINTS.map(point => (
              <View key={point} className="flex-row items-center gap-2.5">
                <View className="h-6 w-6 items-center justify-center rounded-full bg-brand/[0.12]">
                  <Check size={14} color={AI_API_BRAND} strokeWidth={2.5} />
                </View>
                <Text className="flex-1 text-[14px] leading-5 text-white/85">{point}</Text>
              </View>
            ))}
          </View>
          <IntroLink
            label="Learn about Antseed"
            onPress={() => void Linking.openURL(ANTSEED_DOCS_URL).catch(() => undefined)}
          />
        </>
      ) : null}
    </View>
  );
};

export const AiApiIntroSteps = ({
  cashbackRate,
  onOpenSetup,
}: {
  cashbackRate: number;
  onOpenSetup: () => void;
}) => {
  const rate = formatAiApiRate(cashbackRate);
  const steps = [
    {
      title: 'Get your API key',
      body: 'One key for every model. Takes a few seconds.',
    },
    {
      title: 'Plug it into your agent',
      body: 'Paste it into Claude Code, Codex, OpenClaw or your own agent. We show you how.',
      hasSetupLink: true,
    },
    {
      title: `Get ${rate} back`,
      body: `What your agents use is paid from your Wallet. ${
        cashbackRate === 0.5 ? 'Half' : rate
      } of it comes back as cashback.`,
    },
  ];

  return (
    <View className="gap-[18px] rounded-twice bg-card px-4 py-[18px]">
      <Text className="text-[16px] font-semibold leading-5 text-white">How it works</Text>
      {steps.map((step, index) => (
        <View key={step.title} className="flex-row items-start gap-3.5">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-[#2A2A2A]">
            <Text className="text-[14px] font-semibold text-white">{index + 1}</Text>
          </View>
          <View className="flex-1 gap-[3px]">
            <Text className="text-[15px] font-semibold leading-[21px] text-white">
              {step.title}
            </Text>
            <Text className="text-[14px] leading-[19px] text-white/60">{step.body}</Text>
            {step.hasSetupLink ? (
              <View className="pt-[3px]">
                <SetupLink onPress={onOpenSetup} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
      <AntseedRow />
    </View>
  );
};

export const AiApiIntroFaq = ({
  cashbackRate,
  cashbackMonthlyCapUsd,
  settlementDays,
  billingTokens,
  onOpenSetup,
}: {
  cashbackRate: number;
  cashbackMonthlyCapUsd: number;
  settlementDays: number;
  billingTokens: string[];
  onOpenSetup: () => void;
}) => {
  const [expanded, setExpanded] = useState<number | null>(0);
  const rate = formatAiApiRate(cashbackRate);
  const funds = formatAiApiBillingFunds(billingTokens);
  const walletFunds = billingTokens.length === 1 ? funds : 'funds';
  const questions = [
    {
      question: 'How do I set it up?',
      answer:
        'Create a key, then paste it and our base URL into your agent. We have step-by-step guides for Claude Code, Codex and OpenClaw.',
      hasSetupLink: true,
    },
    {
      question: 'Which apps does it work with?',
      answer:
        'You can use it with Claude Code, Codex, OpenClaw, Hermes, OpenCode, or your own agent that supports a custom API endpoint.',
    },
    {
      question: 'How do I pay for it?',
      answer:
        'You pay as you go from your Wallet. Set a monthly spending limit for each API key when you create it.',
    },
    {
      question: `When do I get my ${rate} back?`,
      answer: `Cashback lands in USD Yield ${settlementDays} ${settlementDays === 1 ? 'day' : 'days'} after each charge.`,
    },
    {
      question: 'Is there a cap on the cashback?',
      answer:
        cashbackMonthlyCapUsd > 0
          ? `Your tier gets up to ${formatAiApiLimit(cashbackMonthlyCapUsd)} in AI cashback per month.`
          : 'There’s no monthly AI cashback cap on your tier.',
    },
    {
      question: 'Why is it so much cheaper?',
      answer:
        'Antseed is an open market of AI providers. Solid sets one price for each model from what that market charges, so you can see how it compares with the official API price.',
    },
    {
      question: 'Do you see my prompts?',
      answer: 'Solid doesn’t store your prompts or answers. We keep usage data for billing.',
    },
    {
      question: `What if my Wallet runs out of ${walletFunds}?`,
      answer:
        'New requests stop until your Wallet has enough to cover the charges. Add funds to start using your keys again.',
    },
  ];

  return (
    <View className="gap-1 rounded-twice bg-card px-4 pb-1 pt-[18px]">
      <Text className="text-[16px] font-semibold leading-5 text-white">Questions</Text>
      <View className="pt-1">
        {questions.map(({ question, answer, hasSetupLink }, index) => {
          const isOpen = index === expanded;
          return (
            <View
              key={question}
              className={cn('pb-2', index > 0 && 'border-t border-white/[0.07]')}
            >
              <Pressable
                accessibilityRole="button"
                aria-expanded={isOpen}
                onPress={() => setExpanded(current => (current === index ? null : index))}
                hitSlop={{ bottom: 8 }}
                className="flex-row items-center gap-3 pb-1.5 pt-3.5"
              >
                <Text className="flex-1 text-[15px] font-medium leading-[21px] text-white">
                  {question}
                </Text>
                <AiApiIntroChevron expanded={isOpen} />
              </Pressable>
              <AiApiIntroDisclosure expanded={isOpen}>
                <View className="gap-2 pb-1.5 pr-[30px]">
                  <Text className="text-[14px] leading-5 text-white/60">{answer}</Text>
                  {hasSetupLink ? <SetupLink onPress={onOpenSetup} /> : null}
                </View>
              </AiApiIntroDisclosure>
            </View>
          );
        })}
      </View>
    </View>
  );
};
