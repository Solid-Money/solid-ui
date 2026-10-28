import { memo, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Star, TriangleAlert, X } from 'lucide-react-native';

import SolidAiAvatar from '@/components/Support/SolidAiAvatar';
import { Text } from '@/components/ui/text';
import { rateCase } from '@/lib/support/sync';
import { contextLabel, QUICK_REPLIES } from '@/lib/support/threadState';
import { cn } from '@/lib/utils';

import type { SupportCase, SupportThread } from '@/lib/types/support';
import type { SupportDraftContext } from '@/store/useSupportChatStore';

/** What the pill says while Solid AI looks something up (the server's `activity`). */
export const ACTIVITY_LABELS: Record<string, string> = {
  help_center: 'Searching the help center',
  incidents: 'Checking for known issues',
  verification: 'Checking your verification',
  balances: 'Checking your balances',
  card: 'Checking your card',
  card_payments: 'Looking at your card payments',
  deposits: 'Checking your deposits',
  withdrawals: 'Checking your withdrawals',
  rewards: 'Checking your rewards',
  virtual_account: 'Checking your virtual account',
  spend_mode: 'Checking your card settings',
  app: 'Checking your app version',
  errors: 'Looking at recent errors',
};

/**
 * Solid AI is working on a reply: its gradient keeps moving, and the pill says what
 * it is doing ("Checking your deposits…") when the server tells us, else that
 * it is typing.
 */
const TYPING_ROW = { flexDirection: 'row', alignItems: 'center', gap: 10 } as const;

export const TypingIndicator = memo(function TypingIndicator({
  activity,
}: {
  activity?: string | null;
}) {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const timer = setInterval(() => setDots(count => (count % 3) + 1), 450);
    return () => clearInterval(timer);
  }, []);
  const label = (activity && ACTIVITY_LABELS[activity]) || 'Solid AI is typing';
  return (
    // Layout on a plain View: on web, classes on an Animated.View with `entering` are dropped.
    <View className="mb-3 self-start" accessibilityLiveRegion="polite">
      <Animated.View entering={FadeInDown.duration(250)} style={TYPING_ROW}>
        <SolidAiAvatar size={28} glow={false} />
        <View className="rounded-full bg-card px-3.5 py-2.5">
          <Animated.View key={label} entering={FadeIn.duration(220)}>
            <Text className="text-sm font-medium text-white/70" accessibilityLabel={label}>
              {label}
              <Text className="text-sm font-medium text-white/70">{'.'.repeat(dots)}</Text>
              <Text className="text-sm font-medium text-transparent">{'.'.repeat(3 - dots)}</Text>
            </Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
});

/** A known incident the team has posted, shown above the conversation. */
export const IncidentBanner = memo(function IncidentBanner({
  incidents,
}: {
  incidents: SupportThread['incidents'];
}) {
  if (!incidents.length) return null;
  return (
    <View className="gap-2 px-4 pt-2">
      {incidents.map(incident => (
        <View key={incident.title} className="flex-row gap-2 rounded-xl bg-warning/15 px-3 py-2.5">
          <TriangleAlert size={16} color="#FFC852" />
          <View className="flex-1">
            <Text className="text-sm font-semibold text-warning">{incident.title}</Text>
            {!!incident.message && (
              <Text className="mt-0.5 text-xs leading-4 text-white/80">{incident.message}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
});

/** Common topics to start a fresh case with one tap. */
export const QuickReplies = memo(function QuickReplies({
  onPick,
}: {
  onPick: (text: string) => void;
}) {
  return (
    <View className="mb-2 flex-row flex-wrap justify-end gap-2">
      {QUICK_REPLIES.map(reply => (
        <Pressable
          key={reply}
          onPress={() => onPick(reply)}
          accessibilityRole="button"
          className="rounded-full border border-brand/50 px-3.5 py-2 active:opacity-70 web:hover:bg-brand/10"
        >
          <Text className="text-sm text-brand">{reply}</Text>
        </Pressable>
      ))}
    </View>
  );
});

/** What the chat was opened from, sent with the next message. */
export const ContextCard = memo(function ContextCard({
  context,
  onRemove,
}: {
  context: SupportDraftContext;
  onRemove: () => void;
}) {
  return (
    <View className="mx-3 mb-2 flex-row items-center gap-2 rounded-xl bg-card px-3 py-2">
      <View className="flex-1">
        <Text className="text-xs text-white/50">About: {contextLabel(context.kind)}</Text>
        {!!context.label && (
          <Text numberOfLines={1} className="text-sm text-white">
            {context.label}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove what this message is about"
        className="h-8 w-8 items-center justify-center rounded-full"
      >
        <X size={16} color="#A1A1A1" />
      </Pressable>
    </View>
  );
});

/** One tap to rate a resolved case. */
export const CsatPrompt = memo(function CsatPrompt({ supportCase }: { supportCase: SupportCase }) {
  const [score, setScore] = useState<number | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const rate = (value: number) => {
    if (state === 'sending') return;
    setScore(value);
    setState('sending');
    rateCase(supportCase.id, value).then(
      () => setState('done'),
      () => setState('error'),
    );
  };

  if (state === 'done') {
    return (
      <View className="mb-3 items-center px-6">
        <Text className="text-center text-sm text-white/70">
          {score !== null && score <= 3
            ? 'Thanks for telling us. If something is still wrong, reply here and we will pick it up.'
            : 'Thanks for the rating!'}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-3 items-center gap-2 rounded-2xl bg-card px-4 py-3">
      <Text className="text-center text-sm text-white">
        How did we do on case #{supportCase.number}?
      </Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map(value => (
          <Pressable
            key={value}
            onPress={() => rate(value)}
            accessibilityRole="button"
            accessibilityLabel={`${value} out of 5`}
            className="h-10 w-10 items-center justify-center"
          >
            <Star
              size={26}
              color={score !== null && value <= score ? '#94F27F' : '#6B6B6B'}
              fill={score !== null && value <= score ? '#94F27F' : 'transparent'}
            />
          </Pressable>
        ))}
      </View>
      {state === 'error' && (
        <Text className={cn('text-xs text-destructive')}>
          Could not send. Tap a star to try again.
        </Text>
      )}
    </View>
  );
});
