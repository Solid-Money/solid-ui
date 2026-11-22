import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Info } from 'lucide-react-native';

import {
  AssetLogo,
  assetName,
  CREDIT_COLORS,
  joinNames,
  STATUS_STYLE,
  StatusChip,
} from '@/components/Card/Credit/creditUi';
import { Text } from '@/components/ui/text';
import { formatFraction, type LoanModel } from '@/lib/creditRisk';

import type { LoanSafetyStatus, summarizeLoanSafety } from '@/components/Card/Credit/loanSafety';

const GLYPHS = {
  back: require('@/assets/images/credit-safety/back.svg'),
  next: require('@/assets/images/credit-safety/next.svg'),
  safe: require('@/assets/images/credit-safety/safe.svg'),
  warning: require('@/assets/images/credit-safety/warning.svg'),
  danger: require('@/assets/images/credit-safety/danger.svg'),
  interest: require('@/assets/images/credit-safety/interest.svg'),
  soUSD: require('@/assets/images/credit-safety/usd.svg'),
  soEUR: require('@/assets/images/credit-safety/eur.svg'),
  cbBTC: require('@/assets/images/credit-safety/btc.svg'),
};

export const CreditGlyph = ({ name }: { name: keyof typeof GLYPHS }) => (
  <Image
    accessible={false}
    source={GLYPHS[name]}
    style={name === 'next' ? styles.chevron : styles.glyph}
  />
);

export const CreditCollateralMark = ({ symbol }: { symbol: string }) => {
  if (symbol === 'soUSD' || symbol === 'soEUR' || symbol === 'cbBTC') {
    return (
      <View style={styles.iconCircle}>
        <CreditGlyph name={symbol} />
      </View>
    );
  }
  return <AssetLogo symbol={symbol} />;
};

const sellPoint = (loan: LoanModel) => {
  const { risk } = loan;
  return risk.kind === 'single' && risk.sellPriceUsd !== null && risk.sellPriceUsd > 0n
    ? { asset: risk.asset, price: risk.sellPriceUsd }
    : null;
};

export const LoanPosition = ({
  loan,
  status,
  format,
  formatBalance,
  showSellPoint = false,
}: {
  loan: LoanModel;
  status: LoanSafetyStatus;
  format: (usd: bigint) => string;
  formatBalance: (usd: bigint) => string;
  showSellPoint?: boolean;
}) => {
  const owes = loan.debtUsd > 0n;
  const asset = loan.risk.kind === 'single' ? loan.risk.asset : loan.assets[0];
  const point =
    showSellPoint && (status === 'caution' || status === 'at-risk') ? sellPoint(loan) : null;
  const collateral = joinNames(
    [...loan.assets].sort((a, b) => Number(b.steady) - Number(a.steady)).map(assetName),
  );
  const subtitle = point
    ? `Sell point ${format(point.price)}`
    : collateral
      ? `Backed by ${collateral}`
      : 'Nothing locked';

  return (
    <View style={styles.row}>
      {asset ? <CreditCollateralMark symbol={asset.symbol} /> : null}
      <View style={styles.positionText}>
        <Text className="text-[16px] font-semibold text-white">
          {owes ? formatBalance(loan.debtUsd) : 'Nothing borrowed'}
        </Text>
        <Text className="text-[14px] text-white/60">{subtitle}</Text>
      </View>
      {owes ? (
        <StatusChip status={status} label={status === 'healthy' ? 'Safe' : undefined} />
      ) : null}
    </View>
  );
};

type LoanSafetySummary = ReturnType<typeof summarizeLoanSafety>;

export const loanSafetyCopy = ({ status, affectedLoan }: LoanSafetySummary) => {
  switch (status) {
    case 'healthy':
      return { title: 'Your assets are safe' };
    case 'unknown':
      return {
        title: 'Loan safety unavailable',
        description: 'Some loan data is unavailable right now. Check back shortly.',
      };
    case 'caution':
    case 'at-risk': {
      const point = affectedLoan && sellPoint(affectedLoan);
      const name = point && assetName(point.asset);
      const title =
        status === 'caution'
          ? 'Getting close to the sell point'
          : name
            ? `Your ${name} is at risk`
            : 'A loan is at risk';
      const sale = affectedLoan?.sale;
      if (sale?.kind === 'paused')
        return {
          title,
          description: 'This loan is below its sell point. Sales are currently paused.',
        };
      if (sale)
        return {
          title,
          description: 'This loan has fallen below its sell point. Repay now to reduce your risk.',
        };
      const action =
        status === 'caution' ? 'Repay to move further away.' : 'Repay now to reduce your risk.';
      if (point && point.asset.priceUsd > point.price) {
        const above = formatFraction(
          Number(point.asset.priceUsd - point.price) / Number(point.price),
        );
        const distance = above === '<1%' ? 'less than 1%' : above;
        return {
          title,
          description: `${name} is ${distance} above the price where some of it could be sold. ${action}`,
        };
      }
      return { title, description: `A loan is at or near its sell point. ${action}` };
    }
  }
};

const BANNER_COLORS: Record<LoanSafetyStatus, string> = {
  healthy: '#242B23',
  caution: '#2D2820',
  'at-risk': '#332424',
  unknown: CREDIT_COLORS.card,
};

export const LoanSafetyBanner = ({
  summary,
  format,
  formatBalance,
  onPress,
}: {
  summary: LoanSafetySummary;
  format: (usd: bigint) => string;
  formatBalance: (usd: bigint) => string;
  onPress: () => void;
}) => {
  const { status, positions } = summary;
  const { title, description } = loanSafetyCopy(summary);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens Loan safety"
      className="active:opacity-70"
      onPress={onPress}
      style={[styles.banner, { backgroundColor: BANNER_COLORS[status] }]}
    >
      <View style={styles.bannerHeading}>
        <View style={styles.bannerTitle}>
          {status === 'unknown' ? (
            <Info size={20} color={STATUS_STYLE.unknown.color} />
          ) : (
            <CreditGlyph
              name={status === 'healthy' ? 'safe' : status === 'caution' ? 'warning' : 'danger'}
            />
          )}
          <Text className="flex-1 text-[16px] font-semibold text-white">{title}</Text>
          <CreditGlyph name="next" />
        </View>
        {description ? (
          <Text className="text-[14px] leading-[20px] text-white/75">{description}</Text>
        ) : null}
      </View>
      <View style={styles.divider} />
      {positions.map(({ loan, status }) => (
        <LoanPosition
          key={loan.chainId}
          loan={loan}
          status={status}
          format={format}
          formatBalance={formatBalance}
          showSellPoint
        />
      ))}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  banner: { borderRadius: 20, gap: 16, padding: 16 },
  bannerHeading: { gap: 8 },
  bannerTitle: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  chevron: { width: 16, height: 16 },
  glyph: { width: 20, height: 20 },
  divider: { backgroundColor: CREDIT_COLORS.divider, height: 1 },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  positionText: { flex: 1, gap: 3, minWidth: 0 },
});
