import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { CollateralLogo } from '@/components/Card/NewCardDetails/SpendMode/SpendModePanels';
import {
  collateralIcon,
  collateralName,
} from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import { Text } from '@/components/ui/text';
import { formatBps, type LoanAsset, type LoanModel, type LoanStatus } from '@/lib/creditRisk';

import type { ReactNode } from 'react';

/**
 * The pieces the Credit page and its sheets are built from. Presentation only: every figure
 * arrives worked out from `lib/creditRisk`.
 */

export const CREDIT_COLORS = {
  green: '#94F27F',
  amber: '#F5B547',
  red: '#D96167',
  card: '#1C1C1C',
  raised: '#2B2B2B',
  divider: 'rgba(255, 255, 255, 0.08)',
} as const;

/**
 * Green, amber, red. Amber is "Getting close", about 5% from a sale; red is kept for under 1.0,
 * where part of the loan can actually be sold.
 */
export const STATUS_STYLE: Record<LoanStatus, { label: string; color: string; tint: string }> = {
  healthy: { label: 'Healthy', color: CREDIT_COLORS.green, tint: 'rgba(148, 242, 127, 0.15)' },
  caution: { label: 'Getting close', color: CREDIT_COLORS.amber, tint: 'rgba(245, 181, 71, 0.15)' },
  'at-risk': { label: 'At risk', color: CREDIT_COLORS.red, tint: 'rgba(217, 97, 103, 0.15)' },
};

export const StatusChip = ({ status }: { status: LoanStatus }) => (
  <View style={[styles.chip, { backgroundColor: STATUS_STYLE[status].tint }]}>
    <Text className="text-[13px] font-medium" style={{ color: STATUS_STYLE[status].color }}>
      {STATUS_STYLE[status].label}
    </Text>
  </View>
);

/**
 * Where the loan is (LTV, filled) against where a sale starts (the marker, with the zone past it).
 * The line is the loan's blended threshold, so it drifts a little as prices move.
 */
export const LtvBar = ({
  ltv,
  soldAt,
  status,
}: {
  ltv: number;
  soldAt: number;
  status: LoanStatus;
}) => {
  const fill = `${Math.min(Math.max(ltv, 0), 1) * 100}%` as const;
  const line = `${Math.min(Math.max(soldAt, 0), 1) * 100}%` as const;
  return (
    <View accessible={false} style={styles.bar}>
      <View style={styles.track} />
      <View style={[styles.zone, { left: line }]} />
      <View style={[styles.fill, { width: fill, backgroundColor: STATUS_STYLE[status].color }]} />
      <View style={[styles.marker, { left: line }]} />
    </View>
  );
};

/** What the app calls an asset, and its mark. */
export const assetName = (asset: Pick<LoanAsset, 'symbol' | 'chainId'>) => collateralName(asset);

export const AssetLogo = ({ symbol }: { symbol: string }) => (
  <CollateralLogo icon={collateralIcon(symbol)} />
);

/**
 * A loan's mark: its collateral, never one token beside a dollar amount — which reads as that much
 * of the token. One asset is its own logo; two overlap; more show the largest and a count.
 */
export const CollateralStack = ({ assets }: { assets: readonly Pick<LoanAsset, 'symbol'>[] }) => {
  if (assets.length <= 1) {
    return (
      <View style={styles.single}>
        <AssetLogo symbol={assets[0]?.symbol ?? 'soUSD'} />
      </View>
    );
  }
  const more = assets.length > 2 ? assets.length - 1 : 0;
  return (
    <View accessible={false} style={styles.stack}>
      <View style={styles.stackFirst}>
        <AssetLogo symbol={assets[0].symbol} />
      </View>
      <View style={styles.stackSecond}>
        {more ? (
          <View style={styles.more}>
            <Text className="text-[12px] font-semibold text-white">+{more}</Text>
          </View>
        ) : (
          <AssetLogo symbol={assets[1].symbol} />
        )}
      </View>
    </View>
  );
};

/** "EUR Yield and Bitcoin", "EUR Yield, Bitcoin and Solana". */
export const joinNames = (names: readonly string[]): string =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "Backed by $1,011.23 of EUR Yield and Bitcoin", or "… across 6 assets" past two. */
export const backedByLine = (loan: LoanModel, format: (usd: bigint) => string): string => {
  if (loan.assets.length === 0) return 'Nothing locked';
  const value = format(loan.valueUsd);
  if (loan.assets.length > 2) return `Backed by ${value} across ${loan.assets.length} assets`;
  return `Backed by ${value} of ${joinNames(loan.assets.map(assetName))}`;
};

/** "5%", or "5–7.5%" when the loan's assets carry different penalties. */
export const penaltyText = (loan: Pick<LoanModel, 'penaltyBps'>): string =>
  loan.penaltyBps.min === loan.penaltyBps.max
    ? formatBps(loan.penaltyBps.max)
    : `${formatBps(loan.penaltyBps.min).replace('%', '')}–${formatBps(loan.penaltyBps.max)}`;

/**
 * Token units for people: whole and two places for most balances, enough significant digits
 * for a small amount of an expensive coin ("0.00572"). Worked in bigint, never through a float.
 */
export const formatTokenUnits = (amount: bigint, decimals: number): string => {
  if (amount === 0n) return '0';
  const sign = amount < 0n ? '-' : '';
  const abs = amount < 0n ? -amount : amount;
  const one = 10n ** BigInt(decimals);
  if (abs >= one) {
    const digits = abs >= 1000n * one ? 2 : 4;
    return sign + renderScaled(roundToFraction(abs, decimals, digits), digits);
  }
  // Under 1, three significant digits: the zeros after the point, then three more places.
  const digits = decimals - abs.toString().length + 3;
  return sign + renderScaled(roundToFraction(abs, decimals, digits), digits);
};

/** `amount` (in `decimals`) as an integer of `digits` fraction places, rounded half up. */
const roundToFraction = (amount: bigint, decimals: number, digits: number): bigint => {
  if (digits >= decimals) return amount * 10n ** BigInt(digits - decimals);
  const divisor = 10n ** BigInt(decimals - digits);
  return (amount + divisor / 2n) / divisor;
};

/** "1,234.5": grouped whole part, fraction without trailing zeros. */
const renderScaled = (scaled: bigint, digits: number): string => {
  const unit = 10n ** BigInt(digits);
  const whole = (scaled / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (scaled % unit).toString().padStart(digits, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
};

export const PillButton = ({
  label,
  onPress,
  kind = 'secondary',
  disabled,
  loading,
  size = 'regular',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  /** `compact` in a card's two-button row, `regular` as a sheet's main action. */
  size?: 'regular' | 'compact';
  accessibilityLabel?: string;
}) => (
  <Pressable
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    className="transition-all active:scale-95 active:opacity-80 disabled:opacity-50"
    disabled={disabled || loading}
    onPress={onPress}
    style={[
      styles.button,
      size === 'compact' ? styles.buttonCompact : styles.buttonRegular,
      { backgroundColor: kind === 'primary' ? '#FFFFFF' : CREDIT_COLORS.raised },
    ]}
  >
    {loading ? (
      <ActivityIndicator color={kind === 'primary' ? '#000000' : '#FFFFFF'} />
    ) : (
      <Text
        numberOfLines={1}
        className={`${size === 'compact' ? 'text-[14px]' : 'text-[16px]'} font-semibold ${
          kind === 'primary' ? 'text-black' : 'text-white'
        }`}
      >
        {label}
      </Text>
    )}
  </Pressable>
);

/** Two buttons sharing a row, each as wide as its label needs and the rest split between them. */
export const ButtonRow = ({ children }: { children: ReactNode }) => (
  <View style={styles.buttonRow}>{children}</View>
);

export const KeyValue = ({
  label,
  value,
  tone,
  last,
}: {
  label: string;
  value: ReactNode;
  tone?: 'warn' | 'bad' | 'good';
  last?: boolean;
}) => (
  <View style={[styles.keyValue, !last && styles.keyValueDivider]}>
    <Text className="flex-1 text-[14px] text-white/60">{label}</Text>
    {typeof value === 'string' ? (
      <Text
        className="text-right text-[14px] font-medium text-white"
        style={
          tone
            ? {
                color:
                  tone === 'warn'
                    ? CREDIT_COLORS.amber
                    : tone === 'bad'
                      ? CREDIT_COLORS.red
                      : CREDIT_COLORS.green,
              }
            : undefined
        }
      >
        {value}
      </Text>
    ) : (
      value
    )}
  </View>
);

/** A tinted note inside a card: a suggestion, a countdown, a past sale. */
export const Note = ({
  tone = 'plain',
  children,
}: {
  tone?: 'plain' | 'warn' | 'bad';
  children: ReactNode;
}) => (
  <View
    style={[
      styles.note,
      {
        backgroundColor:
          tone === 'bad'
            ? 'rgba(217, 97, 103, 0.12)'
            : tone === 'warn'
              ? 'rgba(245, 181, 71, 0.1)'
              : 'rgba(255, 255, 255, 0.05)',
      },
    ]}
  >
    {children}
  </View>
);

const styles = StyleSheet.create({
  chip: { alignSelf: 'center', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  bar: { height: 20, justifyContent: 'center' },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    height: 10,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  zone: {
    backgroundColor: 'rgba(217, 97, 103, 0.35)',
    borderBottomRightRadius: 5,
    borderTopRightRadius: 5,
    height: 10,
    position: 'absolute',
    right: 0,
  },
  fill: { borderRadius: 5, height: 10, left: 0, position: 'absolute' },
  marker: {
    backgroundColor: CREDIT_COLORS.red,
    borderRadius: 1,
    height: 20,
    marginLeft: -1,
    position: 'absolute',
    width: 2,
  },
  single: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  stack: { height: 44, width: 44 },
  stackFirst: { left: 0, position: 'absolute', top: 0 },
  stackSecond: {
    backgroundColor: CREDIT_COLORS.card,
    borderRadius: 18,
    left: 10,
    padding: 2,
    position: 'absolute',
    top: 10,
  },
  more: {
    alignItems: 'center',
    backgroundColor: '#3A3A3A',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  button: {
    alignItems: 'center',
    borderRadius: 100,
    flexBasis: 'auto',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonRegular: { height: 50 },
  buttonCompact: { height: 40 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  keyValue: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  keyValueDivider: { borderBottomColor: CREDIT_COLORS.divider, borderBottomWidth: 1 },
  note: { borderRadius: 14, gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
});
