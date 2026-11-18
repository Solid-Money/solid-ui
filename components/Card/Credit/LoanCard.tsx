import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, Clock3, TriangleAlert } from 'lucide-react-native';

import {
  AssetLogo,
  assetName,
  backedByLine,
  ButtonRow,
  CollateralStack,
  CREDIT_COLORS,
  formatTokenUnits,
  joinNames,
  LtvBar,
  Note,
  penaltyText,
  PillButton,
  StatusChip,
} from '@/components/Card/Credit/creditUi';
import { Text } from '@/components/ui/text';
import {
  formatClock,
  formatFraction,
  formatWait,
  type LoanAsset,
  type LoanModel,
  valueOf,
} from '@/lib/creditRisk';

import type { CreditCollateralAsset } from '@/hooks/useCardCreditPositions';
import type { LoanSaleEvent } from '@/hooks/useLoanSales';
import type { ReactNode } from 'react';
import type { Address } from 'viem';

/** Words with some of them bold: what the risk sentences are made of. */
type Segment = string | { bold: string };

const Sentence = ({ segments, className }: { segments: Segment[]; className?: string }) => (
  <Text className={className ?? 'text-[14px] leading-[20px] text-white/75'}>
    {segments.map((segment, index) =>
      typeof segment === 'string' ? (
        segment
      ) : (
        <Text key={index} className="font-semibold text-white">
          {segment.bold}
        </Text>
      ),
    )}
  </Text>
);

/** "03:21 tomorrow", "18:05 today", "Fri 09:12". */
const formatDeadline = (at: number, now: number): string => {
  const date = new Date(at * 1000);
  const today = new Date(now * 1000);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const days = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) /
      86_400_000,
  );
  if (days === 0) return `${time} today`;
  if (days === 1) return `${time} tomorrow`;
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
};

const formatWhen = (at: number): string =>
  new Date(at * 1000).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** The sentence under a loan's header: what would have to happen for part of it to be sold. */
export const riskSentence = (loan: LoanModel, format: (usd: bigint) => string): Segment[] => {
  const penalty = penaltyText(loan);
  const { risk } = loan;

  if (risk.kind === 'unpriced') {
    return [
      'Some prices in this loan are unavailable right now, so its sell point can’t be shown.',
    ];
  }
  if (loan.status === 'at-risk') {
    return [
      'Up to ',
      { bold: format(loan.maxSaleUsd) },
      ` of this loan can be covered from ${loan.assets.length > 1 ? 'any of its collateral' : 'its collateral'}, plus a ${penalty} penalty.`,
      ...(risk.kind === 'single' && risk.noWaitPriceUsd !== null && loan.sale?.kind === 'countdown'
        ? [
            ` If ${assetName(risk.asset)} falls below `,
            { bold: format(risk.noWaitPriceUsd) },
            ', there’s no wait.',
          ]
        : []),
    ];
  }
  if (risk.kind === 'steady') {
    const names = loan.assets.map(assetName);
    return [
      `${joinNames(names)} ${names.length > 1 ? 'hold their' : 'holds its'} value, so only interest moves this loan toward the sell point.`,
    ];
  }
  if (risk.kind === 'multi') {
    return [
      'Your crypto can fall ',
      { bold: formatFraction(risk.togetherDrop) },
      ` together before part of this loan’s collateral can be sold, with a ${penalty} penalty.`,
    ];
  }
  const name = assetName(risk.asset);
  if (risk.sellPriceUsd === null) return [`${name} alone can’t put this loan at risk.`];
  if (loan.status === 'caution') {
    const above =
      risk.asset.priceUsd > 0n ? Number(risk.asset.priceUsd) / Number(risk.sellPriceUsd) - 1 : 0;
    return [
      `${name} is `,
      { bold: `${formatFraction(above)} above ${format(risk.sellPriceUsd)}` },
      `. Below that, part of this loan’s collateral can be sold to cover it, with a ${penalty} penalty.`,
    ];
  }
  return [
    `If ${name} falls below `,
    { bold: format(risk.sellPriceUsd) },
    ` (${formatFraction(risk.drop ?? 0)} below today), part of this loan’s collateral can be sold to cover it, with a ${penalty} penalty.`,
  ];
};

/** The red (or amber) block for a loan under 1.0: when a sale can happen. */
const SaleBlock = ({
  loan,
  now,
  format,
}: {
  loan: LoanModel;
  now: number;
  format: (usd: bigint) => string;
}) => {
  const sale = loan.sale;
  if (!sale) return null;
  const single = loan.risk.kind === 'single' ? loan.risk : null;
  const graceHours = Math.round(loan.saleWaitSeconds / 3600);

  let title: string;
  let time: string | null = null;
  let detail: string;
  let tone: 'bad' | 'warn' = 'bad';
  switch (sale.kind) {
    case 'countdown':
      title = 'Can be sold in';
      time = formatWait(sale.saleAt - now);
      detail = `${single?.sellPriceUsd ? `${assetName(single.asset)} fell below ${format(single.sellPriceUsd)}.` : 'This loan fell below its sell line.'} Pay it down before ${formatDeadline(sale.saleAt, now)} and nothing is sold.`;
      break;
    case 'now':
      title = 'Can be sold at any time';
      detail =
        loan.unhealthySince > 0 && now >= loan.unhealthySince + loan.saleWaitSeconds
          ? `The ${graceHours}-hour wait is over.`
          : single?.noWaitPriceUsd
            ? `${assetName(single.asset)} is below ${format(single.noWaitPriceUsd)}, so there’s no waiting period.`
            : 'It fell far enough that there’s no waiting period.';
      break;
    case 'unrecorded':
      title = 'Below the sell line';
      detail = `Pay it down now. Once this is recorded, part of it can be sold after a ${graceHours}-hour wait.`;
      break;
    case 'prices-updating':
      title = 'Prices are updating';
      detail = 'Nothing can be sold until every price in this loan is available again.';
      tone = 'warn';
      break;
    case 'paused':
      title = 'Sales are paused';
      detail = 'This loan is below its sell line. Pay it down while sales are paused.';
      tone = 'warn';
      break;
  }
  const color = tone === 'bad' ? CREDIT_COLORS.red : CREDIT_COLORS.amber;

  return (
    <Note tone={tone}>
      <View style={styles.saleTitle}>
        {sale.kind === 'countdown' ? (
          <Clock3 color={color} size={18} />
        ) : (
          <TriangleAlert color={color} size={18} />
        )}
        <Text className="flex-1 text-[14px] font-medium" style={{ color }}>
          {title}
        </Text>
        {time ? (
          <Text
            className="text-[20px] font-semibold"
            style={{ color, fontVariant: ['tabular-nums'] }}
          >
            {time}
          </Text>
        ) : null}
      </View>
      <Text className="text-[14px] leading-[20px] text-white/80">{detail}</Text>
    </Note>
  );
};

interface LoanCardProps {
  loan: LoanModel;
  now: number;
  /** Every asset the instance knows, to name one a sale took entirely. */
  knownAssets: readonly CreditCollateralAsset[];
  sale?: LoanSaleEvent;
  explorerTxUrl?: (hash: string) => string | undefined;
  format: (usd: bigint) => string;
  onRepay: () => void;
  onUnlock: () => void;
  onUnlockAll: () => void;
  onPayDown: (token: Address) => void;
  onAsset: (token: Address) => void;
  onBreakdown: () => void;
  onCancelUnlock: () => void;
  onFinishUnlock: () => void;
  isCancelling: boolean;
  isFinishing: boolean;
  isUnlockingAll: boolean;
  /** Why the last finish was refused, when the loan needs more cover to let go. */
  finishBlocked: string | null;
}

/**
 * One loan (Figma "Credit details", corrected): what is borrowed and what backs it, how close it
 * is to a sale and what would cause one, and the ways out of it — each read from the chain.
 */
const LoanCard = ({
  loan,
  now,
  knownAssets,
  sale,
  explorerTxUrl,
  format,
  onRepay,
  onUnlock,
  onUnlockAll,
  onPayDown,
  onAsset,
  onBreakdown,
  onCancelUnlock,
  onFinishUnlock,
  isCancelling,
  isFinishing,
  isUnlockingAll,
  finishBlocked,
}: LoanCardProps) => {
  const owes = loan.debtUsd > 0n;
  const payDown = loan.status !== 'healthy' ? loan.payDown : null;
  const pending = loan.pendingUnlock;
  const shownChips = loan.assets.slice(0, 3);
  const hiddenChips = loan.assets.length - shownChips.length;
  const volatileCount = loan.assets.filter(asset => !asset.steady).length;

  return (
    <View style={styles.loan}>
      <View style={styles.header}>
        <CollateralStack assets={loan.assets} />
        <View style={styles.headerText}>
          <Text className="text-[16px] font-semibold text-white">
            {owes ? format(loan.debtUsd) : 'Nothing'}{' '}
            <Text className="text-[14px] font-normal text-white/60">borrowed</Text>
          </Text>
          <Text className="text-[14px] text-white/60">{backedByLine(loan, format)}</Text>
        </View>
        {owes ? <StatusChip status={loan.status} /> : null}
      </View>

      {!owes ? (
        <>
          <Text className="text-[14px] leading-[20px] text-white/75">
            {`${format(loan.valueUsd)} is still locked from a loan you’ve repaid. It can come back now.`}
          </Text>
          <PillButton
            label="Unlock all"
            kind="primary"
            size="compact"
            onPress={onUnlockAll}
            loading={isUnlockingAll}
          />
        </>
      ) : (
        <>
          <SaleBlock loan={loan} now={now} format={format} />
          <Sentence segments={riskSentence(loan, format)} />
          {loan.assets.length > 2 || volatileCount > 1 ? (
            <Pressable
              accessibilityRole="button"
              onPress={onBreakdown}
              style={styles.inlineLink}
              hitSlop={8}
            >
              <Text className="text-[14px] text-white/60">See what backs this loan</Text>
              <ChevronRight color="rgba(255,255,255,0.4)" size={16} />
            </Pressable>
          ) : null}
          {loan.valueUsd > 0n ? (
            <>
              <LtvBar ltv={loan.ltv} soldAt={loan.soldAt} status={loan.status} />
              <View style={styles.legend}>
                <Text className="text-[14px] font-medium text-white">LTV {percent(loan.ltv)}</Text>
                <Text className="text-[14px]" style={{ color: CREDIT_COLORS.red }}>
                  Sold at {percent(loan.soldAt)}
                </Text>
              </View>
            </>
          ) : null}
          {payDown ? (
            <Note>
              <Sentence
                className="text-[14px] leading-[20px] text-white/80"
                segments={[
                  'Pay ',
                  { bold: format(payDown.amountUsd) },
                  ` with your locked ${assetName(payDown.asset)} and ${
                    payDown.reachesTarget
                      ? 'this loan is Healthy again'
                      : 'this loan moves back from the line'
                  }. No penalty.`,
                  ...(loan.status === 'at-risk'
                    ? [
                        ' A sale would take ',
                        {
                          bold: format(
                            (payDown.amountUsd *
                              BigInt(10_000 + payDown.asset.liquidationBonusBps)) /
                              10_000n,
                          ),
                        },
                        ` for the same ${format(payDown.amountUsd)}.`,
                      ]
                    : []),
                ]}
              />
            </Note>
          ) : null}
        </>
      )}

      {sale ? (
        <SaleNotice
          sale={sale}
          loan={loan}
          knownAssets={knownAssets}
          format={format}
          explorerTxUrl={explorerTxUrl}
        />
      ) : null}

      {loan.assets.length > 0 ? (
        <View style={styles.locked}>
          <Text className="text-[13px] text-white/50">Locked</Text>
          {shownChips.map(asset => (
            <Pressable
              key={asset.token}
              accessibilityRole="button"
              accessibilityLabel={`${assetName(asset)}, ${format(asset.escrowedValueUsd)} locked`}
              className="active:opacity-70"
              onPress={() => onAsset(asset.token)}
              style={styles.pill}
            >
              <Text className="text-[13px] text-white/70">{assetName(asset)}</Text>
              <Text className="text-[13px] font-medium text-white">
                {format(asset.escrowedValueUsd)}
              </Text>
            </Pressable>
          ))}
          {hiddenChips > 0 ? (
            <Pressable
              accessibilityRole="button"
              className="active:opacity-70"
              onPress={onBreakdown}
              style={styles.pill}
            >
              <Text className="text-[13px] text-white/70">+{hiddenChips} more</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {pending ? (
        <PendingUnlock
          loan={loan}
          now={now}
          format={format}
          onCancel={onCancelUnlock}
          onFinish={onFinishUnlock}
          isCancelling={isCancelling}
          isFinishing={isFinishing}
          finishBlocked={finishBlocked}
        />
      ) : null}

      {owes ? (
        <ButtonRow>
          {payDown ? (
            <>
              <PillButton
                label={`Pay down with ${assetName(payDown.asset)}`}
                kind="primary"
                size="compact"
                onPress={() => onPayDown(payDown.asset.token)}
              />
              <PillButton label="Repay with cash" size="compact" onPress={onRepay} />
            </>
          ) : (
            <>
              <PillButton label="Repay" size="compact" onPress={onRepay} />
              {pending || loan.assets.length === 0 ? null : (
                <PillButton label="Unlock" size="compact" onPress={onUnlock} />
              )}
            </>
          )}
        </ButtonRow>
      ) : null}
    </View>
  );
};

/** E3–E5: an unlock waiting out its delay, ready, or refused at release. */
const PendingUnlock = ({
  loan,
  now,
  format,
  onCancel,
  onFinish,
  isCancelling,
  isFinishing,
  finishBlocked,
}: {
  loan: LoanModel;
  now: number;
  format: (usd: bigint) => string;
  onCancel: () => void;
  onFinish: () => void;
  isCancelling: boolean;
  isFinishing: boolean;
  finishBlocked: string | null;
}) => {
  const pending = loan.pendingUnlock!;
  const asset: LoanAsset | undefined = pending.asset;
  const name = asset ? assetName(asset) : 'Collateral';
  const value = asset
    ? format(valueOf(pending.amount, asset.priceUsd, asset.decimals))
    : formatTokenUnits(pending.amount, 18);
  const remaining = pending.readyAt - now;

  if (finishBlocked) {
    return (
      <Note tone="warn">
        <Text className="text-[14px] font-semibold text-white">{`Couldn’t unlock ${name} yet`}</Text>
        <Text className="text-[14px] leading-[20px] text-white/80">{`${finishBlocked} Your repayment went through.`}</Text>
        <ButtonRow>
          <PillButton
            label="Try again"
            kind="primary"
            size="compact"
            onPress={onFinish}
            loading={isFinishing}
          />
          <PillButton
            label="Unlock less"
            size="compact"
            onPress={onCancel}
            loading={isCancelling}
          />
        </ButtonRow>
      </Note>
    );
  }

  return (
    <View style={styles.pending}>
      {asset ? <AssetLogo symbol={asset.symbol} /> : null}
      <View style={styles.headerText}>
        <Text className="text-[15px] font-medium text-white">{name}</Text>
        <Text
          className="text-[13px]"
          style={{ color: remaining > 0 ? CREDIT_COLORS.amber : CREDIT_COLORS.green }}
        >
          {remaining > 0
            ? `Unlocking ${value} · ready in ${formatClock(remaining)}`
            : `${value} ready to unlock`}
        </Text>
      </View>
      {remaining > 0 ? (
        <PillButton label="Cancel" size="compact" onPress={onCancel} loading={isCancelling} />
      ) : (
        <PillButton
          label="Finish"
          kind="primary"
          size="compact"
          onPress={onFinish}
          loading={isFinishing}
        />
      )}
    </View>
  );
};

/** E2: part of the loan was sold. Nothing else tells the cardholder. */
const SaleNotice = ({
  sale,
  loan,
  knownAssets,
  format,
  explorerTxUrl,
}: {
  sale: LoanSaleEvent;
  loan: LoanModel;
  knownAssets: readonly CreditCollateralAsset[];
  format: (usd: bigint) => string;
  explorerTxUrl?: (hash: string) => string | undefined;
}) => {
  const asset =
    loan.assets.find(candidate => candidate.token.toLowerCase() === sale.token.toLowerCase()) ??
    knownAssets.find(candidate => candidate.token.toLowerCase() === sale.token.toLowerCase());
  const name = asset ? assetName(asset) : 'collateral';
  const bonus = BigInt(asset?.liquidationBonusBps ?? 0);
  const taken = (sale.repaidUsd * (10_000n + bonus)) / 10_000n;
  const link = explorerTxUrl?.(sale.transactionHash);
  const body: ReactNode = (
    <Sentence
      className="text-[14px] leading-[20px] text-white/80"
      segments={[
        `${formatWhen(sale.timestamp)}: we sold ${asset ? `${formatTokenUnits(sale.seized, asset.decimals)} ${name}` : name}, about `,
        { bold: format(taken) },
        `, to cover ${format(sale.repaidUsd)} of this loan. ${format(taken - sale.repaidUsd)} of that was the penalty.`,
      ]}
    />
  );
  return (
    <Note tone="bad">
      <Text className="text-[14px] font-semibold text-white">Part of this loan was sold</Text>
      {body}
      {link ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(link)}
          style={styles.inlineLink}
          hitSlop={8}
        >
          <Text className="text-[14px] text-white/60">See the transaction</Text>
          <ChevronRight color="rgba(255,255,255,0.4)" size={16} />
        </Pressable>
      ) : null}
    </Note>
  );
};

const styles = StyleSheet.create({
  loan: { gap: 12, padding: 16 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  headerText: { flex: 1, gap: 2 },
  saleTitle: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  inlineLink: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4 },
  locked: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pending: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
});

export default LoanCard;
