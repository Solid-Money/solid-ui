import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight, Coins, HandCoins, Unlock } from 'lucide-react-native';

import {
  AssetLogo,
  assetName,
  backedByLine,
  ButtonRow,
  CollateralStack,
  CREDIT_COLORS,
  formatTokenUnits,
  KeyValue,
  Note,
  penaltyText,
  PillButton,
  StatusChip,
} from '@/components/Card/Credit/creditUi';
import {
  type CardSheetPresentation,
  sheetBodyInset,
} from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import SheetIconButton from '@/components/Card/NewCardDetails/SpendMode/SheetIconButton';
import { Text } from '@/components/ui/text';
import {
  formatClock,
  formatFraction,
  freeToUnlock,
  type LoanAsset,
  type LoanModel,
  type LoanRisk,
  quoteUnlock,
  type UnlockQuote,
  WAD,
} from '@/lib/creditRisk';

import type { CreditCollateralAsset, CreditInstancePosition } from '@/hooks/useCardCreditPositions';
import type { CardRepayState } from '@/hooks/useCardRepay';
import type { RepaySource } from '@/lib/utils/cardRepay';
import type { ReactNode } from 'react';
import type { Address } from 'viem';

type Format = (usd: bigint) => string;

const percentOf = (wad: bigint): string => {
  const value = Number((wad * 1000n) / WAD) / 10;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
};

const sameToken = (a: Address, b: Address) => a.toLowerCase() === b.toLowerCase();

/** A sheet step's header: back on the left, the title, and close on the desktop modal. */
export const SheetHeader = ({
  title,
  onBack,
  onClose,
  presentation,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  presentation: CardSheetPresentation;
}) => (
  <View style={styles.header}>
    {onBack ? (
      <SheetIconButton icon="back" accessibilityLabel="Back" onPress={onBack} />
    ) : (
      <View style={styles.headerSpacer} />
    )}
    <Text className="flex-1 text-center text-[20px] font-semibold text-white" numberOfLines={1}>
      {title}
    </Text>
    {presentation === 'modal' ? (
      <SheetIconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
    ) : (
      <View style={styles.headerSpacer} />
    )}
  </View>
);

export const SheetBody = ({
  presentation,
  topPadding,
  children,
}: {
  presentation: CardSheetPresentation;
  topPadding: number;
  children: ReactNode;
}) => (
  <View
    style={{ gap: 18, paddingHorizontal: sheetBodyInset(presentation), paddingTop: topPadding }}
  >
    {children}
  </View>
);

const Card = ({ children, flush }: { children: ReactNode; flush?: boolean }) => (
  <View style={[styles.card, flush && styles.cardFlush]}>{children}</View>
);

const Divider = () => <View style={styles.divider} />;

const ActionRow = ({
  icon,
  title,
  detail,
  onPress,
  disabled,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    className="active:opacity-70"
    disabled={disabled}
    onPress={onPress}
    style={[styles.actionRow, disabled && styles.disabled]}
  >
    <View style={styles.actionIcon}>{icon}</View>
    <View style={styles.grow}>
      <Text className="text-[16px] font-semibold text-white">{title}</Text>
      <Text className="text-[14px] leading-[19px] text-white/60">{detail}</Text>
    </View>
    {disabled ? null : <ChevronRight color="rgba(255,255,255,0.4)" size={16} />}
  </Pressable>
);

// ---------------------------------------------------------------------------------------------
// F · Repay — which loan
// ---------------------------------------------------------------------------------------------

/**
 * Only shown with debt on both chains: each loan is repaid on its own. The riskiest is picked
 * first. With one loan, Repay goes straight to its repay step and this never appears.
 */
export const LoanPickerView = ({
  loans,
  format,
  onContinue,
}: {
  loans: LoanModel[];
  format: Format;
  onContinue: (chainId: number) => void;
}) => {
  const owing = loans.filter(loan => loan.debtUsd > 0n);
  const [picked, setPicked] = useState<number | undefined>(owing[0]?.chainId);

  return (
    <>
      <Text className="-mt-2 text-center text-[14px] leading-[20px] text-white/65">
        Each loan is repaid on its own. Repaying one doesn’t change the other.
      </Text>
      <View style={styles.stack}>
        {owing.map(loan => {
          const selected = picked === loan.chainId;
          return (
            <Pressable
              key={loan.chainId}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setPicked(loan.chainId)}
              style={[styles.radioRow, selected && styles.radioRowSelected]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <CollateralStack assets={loan.assets} />
              <View style={styles.grow}>
                <Text className="text-[16px] font-semibold text-white">
                  {format(loan.debtUsd)}{' '}
                  <Text className="text-[14px] font-normal text-white/60">borrowed</Text>
                </Text>
                <Text className="text-[13px] text-white/60" numberOfLines={2}>
                  {backedByLine(loan, format)}
                </Text>
              </View>
              <StatusChip status={loan.status} />
            </Pressable>
          );
        })}
      </View>
      <PillButton
        label="Continue"
        kind="primary"
        disabled={picked === undefined}
        onPress={() => picked !== undefined && onContinue(picked)}
      />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
// N · What backs this loan
// ---------------------------------------------------------------------------------------------

export const BreakdownView = ({
  loan,
  format,
  onAsset,
  onPayDown,
  onRepay,
}: {
  loan: LoanModel;
  format: Format;
  onAsset: (token: Address) => void;
  onPayDown: (token: Address) => void;
  onRepay: () => void;
}) => {
  const together = loan.risk.kind === 'multi' ? loan.risk.togetherDrop : null;
  const payDown = loan.payDown;

  return (
    <>
      <Text className="-mt-2 text-center text-[14px] leading-[20px] text-white/65">
        {`${format(loan.debtUsd)} borrowed · ${backedByLine(loan, format).replace('Backed by', 'backed by')}`}
      </Text>
      {together !== null ? (
        <Note>
          <Text className="text-[14px] leading-[20px] text-white/80">
            {'Your crypto can fall '}
            <Text className="font-semibold text-white">{formatFraction(together)}</Text>
            {
              ' together before part of this loan can be sold. Yield assets are held steady in this figure.'
            }
          </Text>
        </Note>
      ) : null}
      <Card flush>
        {loan.assets.map((asset, index) => (
          <View key={asset.token}>
            {index ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              className="active:opacity-70"
              onPress={() => onAsset(asset.token)}
              style={styles.assetRow}
            >
              <AssetLogo symbol={asset.symbol} />
              <View style={styles.grow}>
                <Text className="text-[16px] font-semibold text-white">{assetName(asset)}</Text>
                <Text className="text-[13px] text-white/60">
                  {`${format(asset.escrowedValueUsd)} locked · sold at ${percentOf(asset.ltWad)}`}
                </Text>
                <View style={styles.share}>
                  <View
                    style={[
                      styles.shareFill,
                      { width: `${Math.round(asset.shareOfCover * 100)}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text className="text-right text-[14px] font-semibold text-white">
                  {`${Math.round(asset.shareOfCover * 100)}% of cover`}
                </Text>
                <Text className="text-right text-[13px] text-white/50">
                  {asset.steady
                    ? 'Holds its value'
                    : asset.aloneDrop !== null
                      ? `Alone: −${formatFraction(asset.aloneDrop)}`
                      : 'Can’t alone'}
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </Card>
      {payDown ? (
        <Note>
          <Text className="text-[14px] leading-[20px] text-white/80">
            {'Pay down with '}
            <Text className="font-semibold text-white">{assetName(payDown.asset)}</Text>
            {` first. Its sell line is the lowest here (${percentOf(payDown.asset.ltWad)}), so each dollar lifts this loan the most.`}
          </Text>
        </Note>
      ) : null}
      <ButtonRow>
        {payDown ? (
          <PillButton
            label={`Pay down with ${assetName(payDown.asset)}`}
            kind="primary"
            onPress={() => onPayDown(payDown.asset.token)}
          />
        ) : null}
        <PillButton label="Repay with cash" onPress={onRepay} />
      </ButtonRow>
      <Text className="text-center text-[13px] leading-[18px] text-white/50">
        {`Any of these can be the one sold; Solid’s liquidator chooses. Penalty ${penaltyText(loan)}.`}
      </Text>
    </>
  );
};

// ---------------------------------------------------------------------------------------------
// G · Asset sheet — any asset
// ---------------------------------------------------------------------------------------------

/** The risk rows for one asset, matched to its loan: an exact price, its share, or steady. */
const riskRows = (asset: LoanAsset, risk: LoanRisk, format: Format, name: string) => {
  if (asset.steady) return [<KeyValue key="steady" label="Price" value="Holds its value" />];
  if (risk.kind === 'single' && sameToken(risk.asset.token, asset.token)) {
    return [
      <KeyValue
        key="sell"
        label="Can be sold below"
        value={
          risk.sellPriceUsd !== null
            ? `${format(risk.sellPriceUsd)} · ${formatFraction(risk.drop ?? 0)} below today`
            : 'Not on its own'
        }
      />,
    ];
  }
  return [
    <KeyValue
      key="share"
      label="Share of that loan’s cover"
      value={`${Math.round(asset.shareOfCover * 100)}%`}
    />,
    <KeyValue
      key="alone"
      label={`If ${name} alone falls`}
      value={
        asset.aloneDrop !== null
          ? `${formatFraction(asset.aloneDrop)} before a sale`
          : 'Can’t cause a sale alone'
      }
    />,
  ];
};

export const AssetView = ({
  holding,
  loan,
  format,
  now,
  tenderNames,
  onUnlock,
  onPayDown,
  onRepay,
  onUnlockAll,
  isUnlockingAll,
}: {
  /** The asset as the instance reads it: held, locked or not. */
  holding: CreditCollateralAsset;
  /** Its instance's loan, when there is one. */
  loan: LoanModel | undefined;
  format: Format;
  now: number;
  /** "USDC", "USDC or USD Yield": what a cash repayment on this loan can use. */
  tenderNames: string;
  onUnlock: () => void;
  onPayDown: () => void;
  onRepay: () => void;
  onUnlockAll: () => void;
  isUnlockingAll: boolean;
}) => {
  const name = assetName(holding);
  const locked = loan?.assets.find(asset => sameToken(asset.token, holding.token));
  const owes = (loan?.debtUsd ?? 0n) > 0n;
  const free = loan && locked ? freeToUnlock(loan, locked) : null;
  const pending = loan?.pendingUnlock ?? null;
  const looseValue = holding.priceUsable
    ? (holding.loose * holding.priceUsd) / 10n ** BigInt(holding.decimals)
    : 0n;

  const unlockDetail = pending
    ? pending.asset && sameToken(pending.asset.token, holding.token)
      ? 'An unlock of this is already on its way.'
      : `Your ${pending.asset ? assetName(pending.asset) : 'other'} unlock finishes in ${formatClock(pending.readyAt - now)}. One at a time per loan.`
    : free && free.valueUsd > 0n
      ? `Up to ${format(free.valueUsd)} is free now. Repay part of the loan to get more back.`
      : 'Repay part of the loan to move it back to your wallet.';

  return (
    <>
      <View style={styles.assetHead}>
        <AssetLogo symbol={holding.symbol} />
        <View style={styles.grow}>
          <Text className="text-[22px] font-semibold text-white">{name}</Text>
          <Text className="text-[14px] text-white/60">
            {`${formatTokenUnits(holding.amount, holding.decimals)} ${holding.symbol}`}
          </Text>
        </View>
        <Text className="text-[22px] font-semibold text-white">{format(holding.valueUsd)}</Text>
      </View>

      <Card>
        <KeyValue
          label={locked && loan ? `Locked in your ${format(loan.debtUsd)} loan` : 'Locked'}
          value={
            locked
              ? `${format(locked.escrowedValueUsd)}${holding.loose === 0n ? ' · all of it' : ''}`
              : 'Nothing'
          }
        />
        <KeyValue label="Free in your wallet" value={format(looseValue)} />
        {locked && loan && owes ? riskRows(locked, loan.risk, format, name) : null}
        <KeyValue
          label="Borrow up to"
          value={
            holding.countsTowardPower && holding.ltvWad > 0n
              ? `${percentOf(holding.ltvWad)} of its value`
              : 'Not used for borrowing'
          }
          last
        />
      </Card>

      {locked && owes ? (
        <Card flush>
          <ActionRow
            icon={<Unlock color="#FFFFFF" size={20} />}
            title={`Unlock ${name}`}
            detail={unlockDetail}
            onPress={onUnlock}
            disabled={Boolean(pending)}
          />
          <Divider />
          <ActionRow
            icon={<HandCoins color="#FFFFFF" size={20} />}
            title={`Pay down with ${name}`}
            detail={
              locked.priceInBand
                ? `Repay with ${name} that’s already locked. No penalty.`
                : `${name}’s price is unavailable right now.`
            }
            onPress={onPayDown}
            disabled={!locked.priceInBand}
          />
          <Divider />
          <ActionRow
            icon={<Coins color="#FFFFFF" size={20} />}
            title="Repay with cash"
            detail={`Use ${tenderNames} from your wallet.`}
            onPress={onRepay}
          />
        </Card>
      ) : locked && !owes ? (
        <>
          <Text className="text-[14px] leading-[20px] text-white/70">
            Nothing is owed on this loan, so all of it can come back now.
          </Text>
          <PillButton
            label="Unlock all"
            kind="primary"
            onPress={onUnlockAll}
            loading={isUnlockingAll}
          />
        </>
      ) : (
        <Text className="text-[14px] leading-[20px] text-white/60">
          {holding.countsTowardPower
            ? `Not backing a loan. It’s locked only when a purchase on credit needs it.`
            : `Not backing a loan.`}
        </Text>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------------------------
// P · Unlock — which asset
// ---------------------------------------------------------------------------------------------

/** Only for a loan holding two or more assets: its Unlock has to ask which. */
export const UnlockPickerView = ({
  position,
  loan,
  now,
  format,
  onPick,
}: {
  position: CreditInstancePosition;
  loan: LoanModel;
  now: number;
  format: Format;
  onPick: (token: Address) => void;
}) => (
  <>
    <Text className="-mt-2 text-center text-[14px] leading-[20px] text-white/65">
      {`${format(loan.debtUsd)} borrowed. Pick the asset you want back.`}
    </Text>
    <Card flush>
      {loan.assets.map((asset, index) => {
        const free = freeToUnlock(loan, asset);
        const all = quoteUnlock({
          position,
          loan,
          asset,
          amount: asset.escrowed,
          source: { kind: 'wallet' },
          nowSeconds: now,
        });
        return (
          <View key={asset.token}>
            {index ? <Divider /> : null}
            <Pressable
              accessibilityRole="button"
              className="active:opacity-70"
              onPress={() => onPick(asset.token)}
              style={styles.assetRow}
            >
              <AssetLogo symbol={asset.symbol} />
              <View style={styles.grow}>
                <Text className="text-[16px] font-semibold text-white">{assetName(asset)}</Text>
                <Text className="text-[13px] text-white/60">{`${format(asset.escrowedValueUsd)} locked`}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text className="text-right text-[14px] font-semibold text-white">
                  {`Free now ${format(free.valueUsd)}`}
                </Text>
                <Text className="text-right text-[13px] text-white/50">
                  {all.requiresFullRepay
                    ? 'All of it: repay in full'
                    : all.repayUsd > 0n
                      ? `All of it: repay ${format(all.repayUsd)}`
                      : 'All of it is free'}
                </Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.4)" size={16} />
            </Pressable>
          </View>
        );
      })}
    </Card>
    <Text className="text-center text-[13px] text-white/50">
      Each figure assumes only that asset is unlocked.
    </Text>
  </>
);

// ---------------------------------------------------------------------------------------------
// H · Unlock part of any asset
// ---------------------------------------------------------------------------------------------

type Preset = 'free' | 25 | 50 | 75 | 100;

/** A way to pay the repayment an unlock needs. */
type UnlockSource =
  | { id: string; kind: 'wallet'; tender: RepaySource; label: string; detail: string }
  | { id: string; kind: 'collateral'; asset: LoanAsset; label: string; detail: string };

/** "Can be sold below $65,311 → $68,188", "Crypto can fall together 21% → 16%", "LTV 54% → 60%". */
const impactRow = (before: LoanModel, after: LoanModel, format: Format): ReactNode => {
  if (
    before.risk.kind === 'single' &&
    after.risk.kind === 'single' &&
    before.risk.sellPriceUsd !== null
  ) {
    return (
      <KeyValue
        label="Can be sold below"
        tone="warn"
        value={`${format(before.risk.sellPriceUsd)} → ${after.risk.sellPriceUsd !== null ? format(after.risk.sellPriceUsd) : 'no longer'}`}
      />
    );
  }
  if (before.risk.kind === 'multi') {
    const afterDrop = after.risk.kind === 'multi' ? formatFraction(after.risk.togetherDrop) : '—';
    return (
      <KeyValue
        label="Crypto can fall together"
        tone="warn"
        value={`${formatFraction(before.risk.togetherDrop)} → ${afterDrop}`}
      />
    );
  }
  return (
    <KeyValue
      label="LTV"
      value={`${Math.round(before.ltv * 100)}% → ${Math.round(after.ltv * 100)}%`}
    />
  );
};

export const UnlockView = ({
  position,
  loan,
  asset,
  repayState,
  now,
  format,
  error,
  isSubmitting,
  onSubmit,
  onRepayInFull,
}: {
  position: CreditInstancePosition;
  loan: LoanModel;
  asset: LoanAsset;
  repayState: CardRepayState | null;
  now: number;
  format: Format;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (input: { quote: UnlockQuote; source: UnlockSource | null }) => void;
  onRepayInFull: () => void;
}) => {
  const name = assetName(asset);
  const free = freeToUnlock(loan, asset);
  const [preset, setPreset] = useState<Preset>(
    free.amount > 0n && free.amount < asset.escrowed ? 'free' : 50,
  );

  const amount =
    preset === 'free'
      ? free.amount
      : preset === 100
        ? asset.escrowed
        : (asset.escrowed * BigInt(preset)) / 100n;

  const sources = useMemo<UnlockSource[]>(() => {
    const wallet = (repayState?.sources ?? [])
      .filter(
        source => source.kind === 'wallet' && !source.unavailableReason && source.valueUsd > 0n,
      )
      .map<UnlockSource>(tender => ({
        id: tender.id,
        kind: 'wallet',
        tender,
        label: `${tender.displaySymbol} in your wallet`,
        detail: `${format(tender.valueUsd)} available`,
      }));
    const locked = loan.assets
      .filter(
        other =>
          !sameToken(other.token, asset.token) && other.priceInBand && other.escrowedValueUsd > 0n,
      )
      .map<UnlockSource>(other => ({
        id: `collateral:${other.token}`,
        kind: 'collateral',
        asset: other,
        label: `${assetName(other)} locked in this loan`,
        detail: other.countsTowardPower
          ? `No penalty. Takes more, as ${assetName(other)} also stops backing the loan`
          : 'No penalty',
      }));
    return [...wallet, ...locked];
  }, [asset.token, format, loan.assets, repayState?.sources]);

  const quoteFor = (source: UnlockSource | undefined) =>
    quoteUnlock({
      position,
      loan,
      asset,
      amount,
      source:
        source?.kind === 'collateral'
          ? { kind: 'collateral', asset: source.asset }
          : { kind: 'wallet' },
      nowSeconds: now,
    });

  // Cash first, the first that covers it; another locked asset only when no cash does.
  const walletQuote = quoteFor(undefined);
  const defaultSource =
    sources.find(
      source => source.kind === 'wallet' && source.tender.valueUsd >= walletQuote.repayUsd,
    ) ??
    sources.find(source => source.kind === 'collateral' && !quoteFor(source).unavailableReason) ??
    sources[0];
  const [sourceId, setSourceId] = useState<string | undefined>(undefined);
  const source = sources.find(candidate => candidate.id === sourceId) ?? defaultSource;
  useEffect(() => {
    if (sourceId && !sources.some(candidate => candidate.id === sourceId)) setSourceId(undefined);
  }, [sourceId, sources]);

  const quote = quoteFor(source);
  const needsRepay = quote.repayUsd > 0n;
  const shortOfCash =
    needsRepay && source?.kind === 'wallet' && source.tender.valueUsd < quote.repayUsd
      ? `Not enough ${source.tender.displaySymbol} in your wallet.`
      : null;
  const blocked = loan.pendingUnlock
    ? 'Another unlock is already waiting on this loan. Finish or cancel it first.'
    : quote.amount === 0n
      ? 'Nothing to unlock at this amount.'
      : needsRepay && !source
        ? 'There’s nothing in your wallet to repay with.'
        : (quote.unavailableReason ?? shortOfCash);

  const presets: { key: Preset; label: string }[] = [
    ...(free.amount > 0n && free.amount < asset.escrowed
      ? [{ key: 'free' as const, label: 'Free' }]
      : []),
    { key: 25, label: '25%' },
    { key: 50, label: '50%' },
    { key: 75, label: '75%' },
    { key: 100, label: 'Max' },
  ];

  return (
    <>
      <Text className="-mt-2 text-center text-[14px] leading-[20px] text-white/65">
        {`Locked in your ${format(loan.debtUsd)} loan: ${format(asset.escrowedValueUsd)}. The loan stays open.`}
      </Text>
      <View style={styles.amount}>
        <Text className="text-[40px] font-semibold text-white">{format(quote.valueUsd)}</Text>
        <Text className="text-[14px] text-white/60">{`${formatTokenUnits(quote.amount, asset.decimals)} ${asset.symbol}`}</Text>
      </View>
      <View style={styles.presets}>
        {presets.map(option => (
          <Pressable
            key={String(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: preset === option.key }}
            onPress={() => setPreset(option.key)}
            style={[styles.preset, preset === option.key && styles.presetSelected]}
          >
            <Text
              className={`text-[14px] font-medium ${preset === option.key ? 'text-black' : 'text-white/80'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {free.valueUsd > 0n ? (
        <Text className="text-center text-[13px] text-white/50">{`Up to ${format(free.valueUsd)} unlocks without repaying anything.`}</Text>
      ) : null}

      {quote.requiresFullRepay ? (
        <Note>
          <Text className="text-[14px] leading-[20px] text-white/80">
            {`Getting this much back means repaying the whole ${format(loan.debtUsd)}. A full repayment returns everything locked at once, with no wait.`}
          </Text>
        </Note>
      ) : needsRepay ? (
        <Card>
          <View style={styles.need}>
            <Text className="text-[14px] text-white/70">To unlock this, repay first</Text>
            <Text className="text-[22px] font-semibold text-white">{format(quote.repayUsd)}</Text>
          </View>
          {sources.map(option => {
            const optionQuote = option.id === source?.id ? quote : quoteFor(option);
            const selected = option.id === source?.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setSourceId(option.id)}
                style={styles.sourceRow}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.grow}>
                  <Text className="text-[14px] text-white">{option.label}</Text>
                  <Text className="text-[12.5px] text-white/50">{option.detail}</Text>
                </View>
                <Text className="text-[14px] font-semibold text-white">
                  {optionQuote.unavailableReason ? '—' : format(optionQuote.repayUsd)}
                </Text>
              </Pressable>
            );
          })}
          <Text className="pb-2 text-[13px] text-white/50">
            Rounded up to the next $5, so a small price move can’t block the unlock.
          </Text>
        </Card>
      ) : null}

      {!quote.requiresFullRepay ? (
        <Card>
          <KeyValue
            label="Loan after"
            value={
              <View style={styles.inline}>
                <Text className="text-[14px] font-medium text-white">
                  {format(quote.debtAfterUsd)}
                </Text>
                <StatusChip status={quote.after.status} />
              </View>
            }
          />
          <KeyValue
            label="Still locked"
            value={
              quote.after.assets.length === 0
                ? 'Nothing'
                : quote.after.assets.length > 2
                  ? `${quote.after.assets.length} assets, ${format(quote.after.valueUsd)}`
                  : quote.after.assets
                      .map(other => `${assetName(other)} ${format(other.escrowedValueUsd)}`)
                      .join(' · ')
            }
          />
          {impactRow(loan, quote.after, format)}
          <KeyValue
            label={`${name} back in your wallet`}
            value={`In about ${Math.max(1, Math.round(position.params.collateralWithdrawDelay / 60))} minutes`}
            last
          />
        </Card>
      ) : null}

      {error ? (
        <Text className="text-center text-[14px]" style={{ color: CREDIT_COLORS.red }}>
          {error}
        </Text>
      ) : null}
      {blocked && !quote.requiresFullRepay ? (
        <Text className="text-center text-[14px]" style={{ color: CREDIT_COLORS.amber }}>
          {blocked}
        </Text>
      ) : null}

      {quote.requiresFullRepay ? (
        <PillButton
          label={`Repay ${format(loan.debtUsd)} in full`}
          kind="primary"
          onPress={onRepayInFull}
        />
      ) : (
        <PillButton
          label={
            needsRepay
              ? `Repay ${format(quote.repayUsd)} and unlock`
              : `Unlock ${format(quote.valueUsd)} of ${name}`
          }
          kind="primary"
          disabled={Boolean(blocked)}
          loading={isSubmitting}
          onPress={() => onSubmit({ quote, source: needsRepay ? (source ?? null) : null })}
        />
      )}
    </>
  );
};

export type { UnlockSource };

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: 8, minHeight: 44 },
  headerSpacer: { width: 44 },
  grow: { flex: 1, gap: 2, minWidth: 0 },
  card: { backgroundColor: CREDIT_COLORS.raised, borderRadius: 16, paddingHorizontal: 16 },
  cardFlush: { paddingHorizontal: 0 },
  divider: { backgroundColor: CREDIT_COLORS.divider, height: 1 },
  stack: { gap: 10 },
  radioRow: {
    alignItems: 'center',
    backgroundColor: CREDIT_COLORS.raised,
    borderColor: 'transparent',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  radioRowSelected: { borderColor: 'rgba(255, 255, 255, 0.7)' },
  radio: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  radioSelected: { borderColor: '#FFFFFF' },
  radioDot: { backgroundColor: '#FFFFFF', borderRadius: 5, height: 10, width: 10 },
  assetRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  share: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    height: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  shareFill: { backgroundColor: 'rgba(255,255,255,0.5)', height: 4 },
  assetHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  disabled: { opacity: 0.5 },
  amount: { alignItems: 'center', gap: 4 },
  presets: { flexDirection: 'row', gap: 8 },
  preset: {
    alignItems: 'center',
    backgroundColor: CREDIT_COLORS.raised,
    borderRadius: 100,
    flex: 1,
    paddingVertical: 9,
  },
  presetSelected: { backgroundColor: '#FFFFFF' },
  need: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sourceRow: {
    alignItems: 'center',
    borderTopColor: CREDIT_COLORS.divider,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  inline: { alignItems: 'center', flexDirection: 'row', gap: 8 },
});
