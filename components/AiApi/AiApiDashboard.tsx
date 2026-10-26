import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  CirclePause,
  Cpu,
  Gauge,
  Info,
  KeyRound,
  Percent,
  Plus,
  Terminal,
  Wallet,
} from 'lucide-react-native';

import { DailyBars } from '@/components/Insights/SpendingBars';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useAllowAiApiCharges, useRetryAiApiBilling } from '@/hooks/useAiApi';
import { track } from '@/lib/analytics';
import { showErrorToast } from '@/lib/errors';

import {
  formatAiApiCashback,
  formatAiApiLastUsed,
  formatAiApiLimit,
  formatAiApiMonth,
  formatAiApiPaidFrom,
  formatAiApiRate,
  formatAiApiShortDate,
  formatAiApiTokens,
  formatAiApiUsd,
} from './aiApiFormat';
import {
  AI_API_AMBER,
  AI_API_BRAND,
  AI_API_ICON_STROKE,
  AiApiBanner,
  AiApiChip,
  AiApiDivider,
  AiApiGroup,
  AiApiRow,
} from './AiApiPrimitives';

import type { AiApiKeySheetView } from './AiApiKeySheet';
import type { AiApiKey, AiApiOverview } from '@/lib/types/ai-api';

const ICON = { size: 20, color: 'white', strokeWidth: AI_API_ICON_STROKE } as const;
const BANNER_ICON = { size: 20, color: AI_API_AMBER, strokeWidth: AI_API_ICON_STROKE } as const;

/** Days in the month a `2026-10` key names. */
const daysInMonth = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map(Number);
  return year && month ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 31;
};

const keyChip = (key: AiApiKey) => {
  if (key.status === 'limit_reached') return <AiApiChip label="Limit reached" tone="warning" />;
  if (key.status === 'paused') return <AiApiChip label="Paused" tone="warning" />;
  if (key.status === 'disabled') return <AiApiChip label="Disabled" tone="warning" />;
  return null;
};

const keySubtitle = (key: AiApiKey) => {
  const masked = `…${key.last4}`;
  if (key.status === 'limit_reached') {
    return `${masked} · ${formatAiApiUsd(key.spentThisMonthUsd)} of ${formatAiApiLimit(
      key.monthlyLimitUsd,
    )}`;
  }
  return key.lastUsedAt
    ? `${masked} · Used ${formatAiApiLastUsed(key.lastUsedAt)}`
    : `${masked} · Not used yet`;
};

const SectionHeading = ({ title, action }: { title: string; action?: ReactNode }) => (
  <View className="flex-row items-center justify-between">
    <Text className="text-[16px] font-semibold text-white">{title}</Text>
    {action}
  </View>
);

/**
 * The one notice the dashboard leads with, most serious first: every key
 * stopped (and why), then charges that will fail, then one key at its limit.
 */
const StatusBanner = ({
  overview,
  onAddFunds,
  onRaiseLimit,
}: {
  overview: AiApiOverview;
  onAddFunds: () => void;
  onRaiseLimit: (key: AiApiKey) => void;
}) => {
  const { allow, isAllowing } = useAllowAiApiCharges();
  const retry = useRetryAiApiBilling();
  const { account, billing, keys } = overview;

  const allowCharges = async () => {
    if (!billing.moduleAddress) return;
    try {
      await allow({
        requiredMandateUsd: billing.requiredMandateUsd,
        moduleAddress: billing.moduleAddress,
        moduleEnabled: billing.mandate?.moduleEnabled ?? false,
        periodSeconds: billing.periodSeconds,
        chainId: billing.chainId,
      });
    } catch (error) {
      void showErrorToast(error, { action: 'ai_api_billing', title: 'Couldn’t allow charges' });
    }
  };

  const startAgain = () =>
    retry.mutate(undefined, {
      onError: error =>
        void showErrorToast(error, {
          action: 'ai_api_billing',
          title: 'Couldn’t start your agents',
        }),
    });

  if (account.paused && account.pausedReason === 'wallet_empty') {
    // Once the Wallet covers what is owed, the button settles it now rather
    // than leaving the agents stopped until the next attempt.
    const covered =
      billing.walletBalanceUsd !== null &&
      billing.openChargeUsd > 0 &&
      billing.walletBalanceUsd >= billing.openChargeUsd;
    return (
      <AiApiBanner
        icon={<CirclePause {...BANNER_ICON} />}
        title="Your agents are paused"
        body={
          covered
            ? 'Your Wallet has enough again. Start your agents to settle the waiting charge.'
            : `Your Wallet doesn’t have enough ${formatAiApiPaidFrom(
                billing.billingTokens,
              )} on Base. Add funds and they start again right away.`
        }
        actionLabel={covered ? 'Start again' : 'Add funds'}
        isLoading={retry.isPending}
        onAction={() => {
          if (covered) return startAgain();
          track(TRACKING_EVENTS.AI_API_ADD_FUNDS_PRESSED);
          onAddFunds();
        }}
      />
    );
  }

  if (account.paused && account.pausedReason === 'admin') {
    return (
      <AiApiBanner
        icon={<CirclePause {...BANNER_ICON} />}
        title="Your agents are paused"
        body="Our team paused your keys. Contact support to find out more."
      />
    );
  }

  if ((account.paused || billing.needsMandate) && keys.length > 0 && billing.moduleAddress) {
    return (
      <AiApiBanner
        icon={<CirclePause {...BANNER_ICON} />}
        title={account.paused ? 'Your agents are paused' : 'Allow charges for your keys'}
        body={`Your keys can spend up to ${formatAiApiLimit(
          billing.requiredMandateUsd,
        )} together. Allow that from your Wallet so usage can be paid.`}
        actionLabel="Allow charges"
        isLoading={isAllowing}
        onAction={allowCharges}
      />
    );
  }

  // Not a pause: requests are refused while the Wallet can't pay for what is
  // already used, and start again on their own once funds arrive.
  if (billing.walletShort) {
    return (
      <AiApiBanner
        icon={<CirclePause {...BANNER_ICON} />}
        title="Your agents are paused"
        body={`Your Wallet doesn’t have enough ${formatAiApiPaidFrom(
          billing.billingTokens,
        )} on Base to pay for what they use. Add funds and they start again within a minute.`}
        actionLabel="Add funds"
        onAction={() => {
          track(TRACKING_EVENTS.AI_API_ADD_FUNDS_PRESSED);
          onAddFunds();
        }}
      />
    );
  }

  const stopped = keys.find(key => key.status === 'limit_reached');
  if (stopped) {
    return (
      <AiApiBanner
        icon={<Gauge {...BANNER_ICON} />}
        title={`${stopped.name} reached its ${formatAiApiLimit(stopped.monthlyLimitUsd)} limit`}
        body={`It starts again on ${formatAiApiShortDate(
          overview.month.resetsAt,
        )}. Raise the limit to keep it running now.${
          keys.length > 1 ? ' Your other keys still work.' : ''
        }`}
        actionLabel="Raise limit"
        onAction={() => onRaiseLimit(stopped)}
      />
    );
  }

  return null;
};

/** Figma "6 · AI agents — dashboard", with the paused and limit states (10, 11) on top. */
const AiApiDashboard = ({
  overview,
  canCreateKey,
  onOpenKey,
  onNewKey,
  onOpenSetup,
  onOpenHowItWorks,
  onAddFunds,
}: {
  overview: AiApiOverview;
  /** False at the key limit, or while the AI API is switched off for new keys. */
  canCreateKey: boolean;
  onOpenKey: (key: AiApiKey, view?: AiApiKeySheetView) => void;
  onNewKey: () => void;
  onOpenSetup: () => void;
  onOpenHowItWorks: () => void;
  onAddFunds: () => void;
}) => {
  const { month, daily, keys, topModels, billing } = overview;
  const totalDays = daysInMonth(month.key);
  const values = Array.from({ length: totalDays }, (_, index) => daily[index]?.spentUsd ?? 0);
  const monthStart = `${month.key}-01T00:00:00Z`;
  const shortMonth = formatAiApiShortDate(monthStart).split(' ')[0];

  return (
    <View className="w-full gap-5 px-4">
      <StatusBanner
        overview={overview}
        onAddFunds={onAddFunds}
        onRaiseLimit={key => onOpenKey(key, 'limit')}
      />

      <View className="items-center gap-1.5 pb-1 pt-2">
        <Text className="text-[15px] text-white/60">Spent this month</Text>
        <Text className="text-[44px] font-semibold text-white">
          {formatAiApiUsd(month.spentUsd)}
        </Text>
        <View className="flex-row items-center gap-1.5 rounded-full bg-brand/[0.12] px-3 py-1.5">
          <Percent size={14} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
          <Text className="text-[14px] font-medium text-brand">
            {formatAiApiCashback(month.cashbackUsd)} cashback
          </Text>
        </View>
      </View>

      <View className="gap-3 rounded-twice bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-[14px] text-white/60">Daily spend</Text>
          <Text className="text-[14px] text-white/60">{formatAiApiMonth(monthStart)}</Text>
        </View>
        <DailyBars
          values={values}
          lastDayIndex={Math.max(0, daily.length - 1)}
          startLabel={`${shortMonth} 1`}
          midLabel={`${shortMonth} 15`}
          endLabel={`${shortMonth} ${totalDays}`}
        />
      </View>

      <AiApiGroup>
        <AiApiRow
          icon={<Wallet {...ICON} />}
          title="Paid from"
          subtitle={
            billing.billingTokens.length > 0
              ? `${formatAiApiPaidFrom(billing.billingTokens)} on Base`
              : undefined
          }
          value={
            billing.walletBalanceUsd === null
              ? 'Wallet'
              : `Wallet · ${formatAiApiUsd(billing.walletBalanceUsd)}`
          }
        />
        <AiApiDivider />
        <AiApiRow
          icon={<Percent {...ICON} />}
          title="Cashback this month"
          subtitle={`${overview.cashbackTier} · ${formatAiApiRate(overview.cashbackRate)} back${
            overview.cashbackMonthlyCapUsd > 0
              ? `, up to ${formatAiApiLimit(overview.cashbackMonthlyCapUsd)} a month`
              : ''
          }`}
          value={formatAiApiCashback(month.cashbackUsd)}
        />
      </AiApiGroup>

      <View className="gap-3">
        <SectionHeading
          title="API keys"
          action={
            canCreateKey ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New key"
                onPress={onNewKey}
                hitSlop={8}
                className="flex-row items-center gap-1.5 rounded-full bg-card px-3 py-[7px] active:opacity-70 web:hover:bg-[#262626]"
              >
                <Plus size={14} color="white" strokeWidth={AI_API_ICON_STROKE} />
                <Text className="text-[13px] font-medium text-white">New key</Text>
              </Pressable>
            ) : null
          }
        />
        <AiApiGroup>
          {keys.map((key, index) => {
            const chip = keyChip(key);
            return (
              <View key={key.id}>
                {index > 0 ? <AiApiDivider /> : null}
                <AiApiRow
                  icon={<KeyRound {...ICON} />}
                  title={key.name}
                  subtitle={keySubtitle(key)}
                  trailing={chip}
                  value={
                    chip
                      ? undefined
                      : `${formatAiApiUsd(key.spentThisMonthUsd)} / ${formatAiApiLimit(
                          key.monthlyLimitUsd,
                        )}`
                  }
                  onPress={() => onOpenKey(key)}
                />
              </View>
            );
          })}
        </AiApiGroup>
      </View>

      {topModels.length > 0 ? (
        <View className="gap-3">
          <SectionHeading title="Top models this month" />
          <AiApiGroup>
            {topModels.map((model, index) => (
              <View key={model.model}>
                {index > 0 ? <AiApiDivider /> : null}
                <AiApiRow
                  icon={<Cpu {...ICON} />}
                  title={model.name}
                  subtitle={formatAiApiTokens(model.tokens)}
                  value={formatAiApiUsd(model.spentUsd)}
                />
              </View>
            ))}
          </AiApiGroup>
        </View>
      ) : null}

      <AiApiGroup>
        <AiApiRow icon={<Terminal {...ICON} />} title="Set up an agent" onPress={onOpenSetup} />
        <AiApiDivider />
        <AiApiRow icon={<Info {...ICON} />} title="How it works" onPress={onOpenHowItWorks} />
      </AiApiGroup>

      <Text className="text-[12px] leading-[17px] text-white/45">
        Usage is taken from your Wallet as you go, a few dollars at a time. Cashback is credited{' '}
        {overview.cashbackSettlementDays} days after each charge, into USD Yield.
      </Text>
    </View>
  );
};

export default AiApiDashboard;
