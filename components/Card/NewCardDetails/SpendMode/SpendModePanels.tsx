import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import HelpBadge from '@/components/Card/NewCardDetails/SpendMode/HelpBadge';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

import type {
  CollateralRowFigures,
  CreditModeFigures,
} from '@/components/Card/NewCardDetails/SpendMode/useCreditModeFigures';
import type {
  SpendableAssetIcon,
  SpendableAssetRow,
} from '@/components/Card/NewCardDetails/SpendMode/useSpendableAssetRows';
import type { SpendModeFigures } from '@/components/Card/NewCardDetails/SpendMode/useSpendModeFigures';

/**
 * The cards the spend-mode surfaces are built from.
 *
 * Presentation only: every figure arrives as a prop from `useSpendModeFigures`, so the
 * same block shows the same number wherever it is placed.
 */

/**
 * Figma 29120:9486, which grows a row per spendable asset held: 23 above the header, the 50pt
 * header, 16 below the last row; the divider (27) and the "Spendable assets" title (34) only when
 * there is a row to title. A row is 48pt, or 56 with a second line. Fixed per row, so the sheet can
 * reserve room for the panel before it renders.
 */
const BALANCE_HEADER_HEIGHT = 23 + 50;
const BALANCE_ASSETS_TITLE_HEIGHT = 27 + 34;
const BALANCE_PANEL_BOTTOM = 16;
const assetRowHeight = (row: Pick<SpendableAssetRow, 'subtitle' | 'detail'>) =>
  row.subtitle || row.detail ? 56 : 48;
export const balancePanelHeight = (
  rows: readonly Pick<SpendableAssetRow, 'subtitle' | 'detail'>[],
) =>
  BALANCE_HEADER_HEIGHT +
  (rows.length
    ? BALANCE_ASSETS_TITLE_HEIGHT + rows.reduce((sum, row) => sum + assetRowHeight(row), 0)
    : 0) +
  BALANCE_PANEL_BOTTOM;
/** Figma 25961:3504. Fixed, so the sheet can reserve room for any stack of these. */
export const BORROWED_PANEL_HEIGHT = 126;

/**
 * Figma 29123:9483, which grows a 58pt row per collateral asset: the borrowed block and the
 * divider take 120, the collateral title 18 + 20 + 8 above the rows, and 12 is left below them.
 * Fixed per row count, so the sheet can still reserve room for the panel before it renders.
 */
const CREDIT_PANEL_BASE_HEIGHT = 120 + 18 + 28 + 12;
const COLLATERAL_ROW_HEIGHT = 58;
export const creditPanelHeight = (collateralRows: number) =>
  collateralRows > 0
    ? CREDIT_PANEL_BASE_HEIGHT + COLLATERAL_ROW_HEIGHT * collateralRows
    : BORROWED_PANEL_HEIGHT;
/**
 * Figma 26974:14829, at its two-line wrap on the 419pt artboard. Not fixed like the panels:
 * a narrower sheet wraps the message to a third line, so the sheet measures the real one.
 */
export const SPEND_MODE_NOTICE_HEIGHT = 63;

const NOTICE_BACKGROUND = getAsset('images/spend-mode-credit-notice-bg.png');
const NOTICE_BADGE = getAsset('images/spend-mode-credit-notice-badge.svg');
const COLLATERAL_ICON = {
  usd: {
    source: getAsset('images/spend-mode-collateral-usd.svg'),
    width: 9.51181,
    height: 18.7791,
  },
  eur: {
    source: getAsset('images/spend-mode-collateral-eur.svg'),
    width: 17,
    height: 17,
  },
} as const;

/** The crypto Base takes as collateral, drawn with the marks the deposit screen uses. */
const COLLATERAL_TOKEN_LOGO = {
  cbbtc: getAsset('images/cbbtc.png'),
  sol: getAsset('images/sol.png'),
  aave: getAsset('images/aave.png'),
  zec: getAsset('images/zec.png'),
} as const;

const TOKEN_LOGO = {
  usdc: getAsset('images/spend-mode-token-usdc.svg'),
  usdt: getAsset('images/spend-mode-token-usdt.svg'),
  eurc: getAsset('images/eurc.png'),
} as const;
const YIELD_GLYPH = {
  usd: {
    source: getAsset('images/spend-mode-yield-usd.svg'),
    width: 9.50464,
    height: 18.7649,
  },
  eur: COLLATERAL_ICON.eur,
} as const;
const BADGE_DOT = getAsset('images/spend-mode-badge-dot.svg');

/**
 * A spendable asset's 32pt logo. The stablecoins use their token logos (USDT's is drawn 36.7pt
 * with its ring overhanging, as in Figma); a yield share is the yield icon with the dot badge
 * (Figma "so-token / soUSD / badge dot").
 */
const AssetLogo = ({ icon }: { icon: SpendableAssetIcon }) => {
  if (icon === 'usdc' || icon === 'eurc') {
    return (
      <Image
        accessible={false}
        source={TOKEN_LOGO[icon]}
        style={icon === 'eurc' ? styles.eurcLogo : styles.tokenLogo}
      />
    );
  }
  if (icon === 'usdt') {
    return (
      <View accessible={false} style={styles.tokenLogo}>
        <Image source={TOKEN_LOGO.usdt} style={styles.usdtLogo} />
      </View>
    );
  }

  const glyph = icon === 'sousd' ? YIELD_GLYPH.usd : YIELD_GLYPH.eur;
  return (
    <View accessible={false} style={styles.tokenLogo}>
      <View style={styles.yieldIcon}>
        <Image source={glyph.source} style={{ width: glyph.width, height: glyph.height }} />
      </View>
      <Image source={BADGE_DOT} style={styles.badgeDot} />
    </View>
  );
};

/** A collateral row's mark: the yield glyph in its tinted circle, or a token's own logo. */
const CollateralLogo = ({ icon }: { icon: CollateralRowFigures['icon'] }) => {
  if (icon === 'usd' || icon === 'eur') {
    return (
      <View accessible={false} style={styles.collateralIcon}>
        <Image
          source={COLLATERAL_ICON[icon].source}
          style={{ width: COLLATERAL_ICON[icon].width, height: COLLATERAL_ICON[icon].height }}
        />
      </View>
    );
  }
  return (
    <Image accessible={false} source={COLLATERAL_TOKEN_LOGO[icon]} style={styles.collateralLogo} />
  );
};

interface BalancePanelProps {
  /** "$246.50": every spendable asset, euro ones at their dollar value. */
  balance: string;
  /** The assets behind it, one row each; the list is left out when the Safe holds none. */
  rows: readonly SpendableAssetRow[];
  /**
   * Opens the add-funds flow. Without one the pill is not drawn: it used to render with
   * nothing behind it, and a button that ignores the tap reads as broken.
   */
  onAddFunds?: () => void;
  /** The "?" beside "Spendable assets". */
  onHelpPress?: () => void;
}

/**
 * "Your balance" with the Add funds pill, over the assets it is made of (Figma 29120:9486): USDC,
 * USDT and soUSD on Fuse, and EURC on Base once euro spending is enabled, each with its own value.
 * A euro asset reads in euros with its dollar value under it.
 */
export const SpendModeBalancePanel = ({
  balance,
  rows,
  onAddFunds,
  onHelpPress,
}: BalancePanelProps) => (
  <View style={[styles.panel, styles.balancePanel, { height: balancePanelHeight(rows) }]}>
    <View style={styles.balanceHeader}>
      <View style={styles.balanceText}>
        <Text className="text-[16px] font-normal leading-[16px] text-white/70">Your balance</Text>
        <Text className="text-[24px] font-medium leading-[24px] text-white">{balance}</Text>
      </View>
      {onAddFunds ? (
        <Pressable
          accessibilityLabel="Add funds"
          accessibilityRole="button"
          className="transition-all active:scale-95 active:opacity-80"
          onPress={onAddFunds}
          style={styles.addFunds}
        >
          <Text className="text-[16px] font-semibold text-black">Add funds</Text>
        </Pressable>
      ) : null}
    </View>
    {rows.length ? (
      <>
        <View style={styles.balanceDivider}>
          <View style={styles.balanceDividerLine} />
        </View>
        <View style={styles.assetsTitle}>
          <Text className="text-[18px] font-medium leading-[18px] text-white">
            Spendable assets
          </Text>
          {onHelpPress ? (
            <Pressable
              accessibilityLabel="How spendable assets work"
              accessibilityRole="button"
              className="active:opacity-80"
              hitSlop={12}
              onPress={onHelpPress}
            >
              <HelpBadge />
            </Pressable>
          ) : (
            <HelpBadge />
          )}
        </View>
        {rows.map(row => (
          <View key={row.key} style={[styles.assetRow, { height: assetRowHeight(row) }]}>
            <AssetLogo icon={row.icon} />
            <View style={styles.assetLeft}>
              <Text className="text-[16px] font-medium leading-[20px] text-white">{row.name}</Text>
              {row.subtitle ? (
                <Text className="text-[14px] font-normal leading-[18px] text-white/50">
                  {row.subtitle}
                </Text>
              ) : null}
            </View>
            <View style={styles.assetRight}>
              <Text className="text-right text-[16px] font-medium leading-[20px] text-white">
                {row.value}
              </Text>
              {row.detail ? (
                <Text className="text-right text-[14px] font-normal leading-[18px] text-white/50">
                  {row.detail}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </>
    ) : null}
  </View>
);

/**
 * "Borrowed / $0.80 / $246.5 … at 5.57% APY" over the drawn-down track — the
 * block three surfaces share: the spend-mode sheet's Credit and Smart panels,
 * the borrow-position card on the card screen, and that card's own sheet.
 *
 * It draws no box of its own. Each of those three sits it on a different
 * background at a different inset, and the only thing that moves between them is
 * where the block starts, so the container owns the padding and this owns the
 * 35 / 15 rhythm inside it.
 */
export type BorrowedSummaryFigures = Pick<
  SpendModeFigures,
  'borrowed' | 'creditLimit' | 'borrowApy' | 'borrowedProgress'
>;

export const BorrowedSummary = ({
  borrowed,
  creditLimit,
  borrowApy,
  borrowedProgress,
}: BorrowedSummaryFigures) => (
  <>
    <Text className="px-5 text-[18px] font-medium leading-[18px] text-white">Borrowed</Text>
    <View style={styles.borrowedRow}>
      <Text className="text-[16px] font-normal leading-[16px] text-white/70">
        {borrowed} / {creditLimit}
      </Text>
      <Text className="text-[16px] font-normal leading-[16px] text-white/70">
        at {borrowApy} APY
      </Text>
    </View>
    <View style={styles.track}>
      {/* Clamped upstream, so this can only ever be 0–100%. */}
      <View style={[styles.fill, { width: `${borrowedProgress * 100}%` }]} />
    </View>
  </>
);

interface NoticeProps {
  message: string;
  /** Reports the rendered height, which grows when the message wraps further. */
  onLayout?: (event: LayoutChangeEvent) => void;
}

/**
 * "! Currently credit mode works only with your USD yield balance" — a caveat about the
 * highlighted mode, in yellow on a faint yellow wash (Figma 26974:14829).
 */
export const SpendModeNotice = ({ message, onLayout }: NoticeProps) => (
  <View onLayout={onLayout} style={styles.notice}>
    <Image
      accessible={false}
      source={NOTICE_BACKGROUND}
      contentFit="cover"
      style={StyleSheet.absoluteFill}
    />
    <View accessible={false} style={styles.noticeBadge}>
      <Image source={NOTICE_BADGE} style={StyleSheet.absoluteFill} />
      <Text className="text-[16px] font-extrabold leading-[18px] text-[#FFD151]">!</Text>
    </View>
    <Text className="flex-1 text-[16px] font-normal leading-[18px] text-[#FFD151]">{message}</Text>
  </View>
);

/** The borrowed block as the spend-mode sheet shows it (Figma 25961:3504). */
export const SpendModeBorrowedPanel = (figures: BorrowedSummaryFigures) => (
  <View style={[styles.panel, styles.borrowedPanel]}>
    <BorrowedSummary {...figures} />
  </View>
);

interface CreditPanelProps extends BorrowedSummaryFigures {
  collateral: CreditModeFigures['collateral'];
  /** The "?" beside "Collateral assets". */
  onHelpPress?: () => void;
}

/**
 * The Credit panel (Figma 29123:9483): the borrowed block over the assets that back it, on
 * every instance the card borrows on — soUSD on Fuse and, once euro spending is enabled, soEUR
 * and the crypto collateral (cbBTC, SOL, AAVE, cbZEC) on Base. A euro asset reads in euros with its dollar value under it, because the line it backs
 * is in dollars.
 */
export const SpendModeCreditPanel = ({
  collateral,
  onHelpPress,
  ...borrowed
}: CreditPanelProps) => (
  <View
    style={[
      styles.panel,
      !collateral.length && styles.borrowedPanel,
      { height: creditPanelHeight(collateral.length) },
    ]}
  >
    {/* Without a row to list — a Safe the lens cannot read yet, or one on v1 — the panel is the
        borrowed block alone, as before, rather than a collateral title over nothing. */}
    {collateral.length ? (
      <View style={styles.creditBorrowed}>
        <BorrowedSummary {...borrowed} />
      </View>
    ) : (
      <BorrowedSummary {...borrowed} />
    )}
    {collateral.length ? <View style={styles.divider} /> : null}
    {collateral.length ? (
      <View style={styles.collateral}>
        <View style={styles.collateralTitle}>
          <View style={styles.collateralTitleLeft}>
            <Text className="text-[18px] font-medium leading-[18px] text-white">
              Collateral assets
            </Text>
            {onHelpPress ? (
              <Pressable
                accessibilityLabel="How collateral works"
                accessibilityRole="button"
                className="active:opacity-80"
                hitSlop={12}
                onPress={onHelpPress}
              >
                <HelpBadge />
              </Pressable>
            ) : (
              <HelpBadge />
            )}
          </View>
          {/* True of the yield shares only: Bitcoin locked as collateral earns nothing. */}
          {collateral.every(row => row.icon === 'usd' || row.icon === 'eur') ? (
            <Text className="text-[14px] font-normal leading-[18px] text-[#94F27F]">
              Keeps earning
            </Text>
          ) : null}
        </View>
        {collateral.map(row => (
          <View key={row.key} style={styles.collateralRow}>
            <CollateralLogo icon={row.icon} />
            <Text className="flex-1 text-[16px] font-medium leading-[20px] text-white">
              {row.label}
            </Text>
            <View style={styles.collateralValue}>
              <Text className="text-right text-[16px] font-medium leading-[20px] text-white">
                {row.value}
              </Text>
              {row.usdEquivalent ? (
                <Text className="text-right text-[14px] font-normal leading-[18px] text-white/50">
                  {row.usdEquivalent}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  panel: { backgroundColor: '#2B2B2B', borderRadius: 20, overflow: 'hidden' },

  // Figma 29120:9486: 23 above, 23 / 24 at the sides; rows below a full-bleed divider.
  balancePanel: { paddingLeft: 23, paddingRight: 24, paddingTop: 23 },
  balanceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 50,
    justifyContent: 'space-between',
  },
  balanceText: { flex: 1, gap: 10 },
  // 27 tall with the line 20 down, running edge to edge past the panel's padding.
  balanceDivider: { height: 27 },
  balanceDividerLine: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 1,
    left: -23,
    position: 'absolute',
    right: -24,
    top: 20,
  },
  assetsTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    height: 34,
    paddingBottom: 8,
    paddingTop: 6,
  },
  assetRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  assetLeft: { flex: 1, gap: 2 },
  assetRight: { alignItems: 'flex-end', gap: 2 },
  tokenLogo: { height: 32, width: 32 },
  eurcLogo: { borderRadius: 16, height: 32, width: 32 },
  // 36.7pt in a 32pt slot: its ring overhangs by 2.35 on every side (inset -7.35%).
  usdtLogo: { height: 36.7059, left: -2.35, position: 'absolute', top: -2.35, width: 36.7059 },
  // Figma "Yield icon": 31.976 × 31.373, 0.31 down, the glyph centred.
  yieldIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 31.373,
    height: 31.373,
    justifyContent: 'center',
    marginTop: 0.31,
    width: 31.976,
  },
  badgeDot: { height: 14, left: 20, position: 'absolute', top: 20, width: 14 },
  addFunds: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    height: 35,
    justifyContent: 'center',
    paddingHorizontal: 13,
  },

  // 126pt tall: the title at 23, the figures 35 below it, the track 15 below those.
  borrowedPanel: { height: BORROWED_PANEL_HEIGHT, paddingTop: 23 },
  borrowedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 17,
    paddingLeft: 20,
    paddingRight: 25,
  },
  // A 10pt round-capped stroke in Figma, so a 10pt bar with a 5pt radius here.
  track: {
    backgroundColor: '#464646',
    borderRadius: 5,
    height: 10,
    marginHorizontal: 23,
    marginTop: 15,
    overflow: 'hidden',
  },
  fill: { backgroundColor: '#94F27F', borderRadius: 5, height: 10 },

  // The borrowed block ends with its track at 99; the divider sits 20 under it, at 119.
  creditBorrowed: { height: 119, paddingTop: 23 },
  divider: { backgroundColor: 'rgba(255, 255, 255, 0.08)', height: 1 },
  collateral: { paddingBottom: 12, paddingLeft: 20, paddingRight: 25, paddingTop: 18 },
  collateralTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 20,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  collateralTitleLeft: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  collateralRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    height: COLLATERAL_ROW_HEIGHT,
  },
  // 32 × 31.4 in Figma, the glyph centred in it at its own size.
  collateralIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15.698,
    height: 31.396,
    justifyContent: 'center',
    width: 32,
  },
  collateralLogo: { borderRadius: 16, height: 32, width: 32 },
  collateralValue: { alignItems: 'flex-end', gap: 4 },

  // Figma places the badge at 15, the message at 50.5 and 12 from the top, and leaves 15
  // under it and 17.5 after it — all from the outer edge. Padding here starts inside the
  // 1pt border, so each is one less; the badge then centres on the message block.
  notice: {
    alignItems: 'center',
    borderColor: 'rgba(255, 209, 81, 0.15)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 13.5,
    overflow: 'hidden',
    paddingBottom: 14,
    paddingLeft: 14,
    paddingRight: 16.5,
    paddingTop: 11,
  },
  noticeBadge: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
});
