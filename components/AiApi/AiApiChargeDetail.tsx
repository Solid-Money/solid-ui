import { View } from 'react-native';
import { Bot, Percent } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { type ActivityEvent, TransactionStatus } from '@/lib/types';

import {
  formatAiApiCashback,
  formatAiApiDay,
  formatAiApiLongDate,
  formatAiApiRate,
  formatAiApiShortDate,
  formatAiApiUsd,
} from './aiApiFormat';
import { AI_API_BRAND, AI_API_ICON_STROKE, AiApiIconTile, AiApiInfoRow } from './AiApiPrimitives';

import type { AiApiChargeMetadata } from '@/lib/types/ai-api';

const STATUS_LABEL: Partial<Record<TransactionStatus, string>> = {
  [TransactionStatus.PENDING]: 'Processing',
  [TransactionStatus.PROCESSING]: 'Processing',
  [TransactionStatus.FAILED]: 'Failed',
};

const CASHBACK_STATUS: Record<NonNullable<AiApiChargeMetadata['cashbackStatus']>, string> = {
  none: '',
  pending: 'Pending',
  paid: 'Credited',
  // Retried by the backend until it lands, so it reads as still on its way.
  failed: 'Delayed',
};

/** `Oct 14, 2026`, or `Oct 12 – Oct 14, 2026` when a charge took in several days. */
const chargeDate = (fromDay?: string, toDay?: string, fallback?: Date) => {
  if (!fromDay || !toDay) return fallback ? formatAiApiLongDate(fallback) : '—';
  const to = formatAiApiLongDate(`${toDay}T00:00:00Z`);
  return fromDay === toDay ? to : `${formatAiApiDay(fromDay)} – ${to}`;
};

/**
 * Figma "9 · Activity — daily AI agents charge": one charge of every key's
 * usage from the Wallet, which key spent what, and the cashback it earns.
 * Usage is charged every few dollars, so a busy day has several.
 */
const AiApiChargeDetail = ({ activity }: { activity: ActivityEvent }) => {
  const meta = (activity.metadata ?? {}) as AiApiChargeMetadata;
  const timestamp = new Date(Number(activity.timestamp) * 1000);
  const amountUsd = Number(activity.amount) || 0;
  const requests = meta.requests ?? 0;
  const statusLabel = STATUS_LABEL[activity.status];
  const cashbackStatus = meta.cashbackStatus ?? 'none';
  const cashbackUsd = Number(meta.cashbackUsd ?? 0);
  const creditedOn = cashbackStatus === 'paid' ? meta.cashbackPaidAt : meta.cashbackPayoutAt;
  const daySummary = meta.toDay ? formatAiApiDay(meta.toDay) : formatAiApiShortDate(timestamp);

  return (
    <View className="gap-5">
      <View className="items-center gap-1.5">
        <AiApiIconTile size={56}>
          <Bot size={26} color="white" strokeWidth={AI_API_ICON_STROKE} />
        </AiApiIconTile>
        <Text className="mt-1 text-[16px] text-white/60">AI API</Text>
        <Text className="text-[40px] font-semibold text-white">−{formatAiApiUsd(amountUsd)}</Text>
        <Text className="text-[14px] text-white/50">
          {daySummary} · {requests.toLocaleString('en-US')}{' '}
          {requests === 1 ? 'request' : 'requests'}
        </Text>
      </View>

      <View className="gap-3 rounded-twice bg-card p-4">
        <AiApiInfoRow label="Paid from" value="Wallet" />
        {(meta.keys ?? []).map(key => (
          <AiApiInfoRow
            key={key.name}
            label={key.name}
            value={formatAiApiUsd(Number(key.amountUsd))}
          />
        ))}
        <AiApiInfoRow label="Requests" value={requests.toLocaleString('en-US')} />
        <AiApiInfoRow label="Date" value={chargeDate(meta.fromDay, meta.toDay, timestamp)} />
        {statusLabel ? (
          <AiApiInfoRow
            label="Status"
            value={statusLabel}
            valueClassName={activity.status === TransactionStatus.FAILED ? 'text-red-400' : ''}
          />
        ) : null}
      </View>

      {cashbackStatus !== 'none' && cashbackUsd > 0 ? (
        <View className="gap-3 rounded-twice bg-card p-4">
          <View className="flex-row items-center gap-3">
            <AiApiIconTile tone="brand">
              <Percent size={18} color={AI_API_BRAND} strokeWidth={AI_API_ICON_STROKE} />
            </AiApiIconTile>
            <Text className="flex-1 text-[16px] font-semibold text-white">Cashback</Text>
            <Text className="text-[16px] font-semibold text-brand">
              {formatAiApiCashback(cashbackUsd)}
            </Text>
          </View>
          <View className="h-px bg-white/[0.08]" />
          {meta.cashbackRate ? (
            <AiApiInfoRow label="Rate" value={`${formatAiApiRate(meta.cashbackRate)} · AI API`} />
          ) : null}
          <AiApiInfoRow
            label="Status"
            value={CASHBACK_STATUS[cashbackStatus]}
            valueClassName={cashbackStatus === 'paid' ? 'text-brand' : ''}
          />
          {creditedOn ? (
            <AiApiInfoRow
              label="Credited"
              value={`${formatAiApiShortDate(creditedOn)}, into USD Yield`}
            />
          ) : null}
        </View>
      ) : null}

      <Text className="text-center text-[12px] leading-[17px] text-white/45">
        Your agents’ usage is taken a few dollars at a time, so it never builds up.
      </Text>
    </View>
  );
};

export default AiApiChargeDetail;
