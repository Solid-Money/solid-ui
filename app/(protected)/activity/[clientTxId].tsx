import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceStrict, minutesToSeconds } from 'date-fns';
import {
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  MessagesSquare,
  Wallet,
  X,
} from 'lucide-react-native';
import { mainnet } from 'viem/chains';

import SupportIcon from '@/assets/images/support-svg';
import ActivityStatusPill from '@/components/Activity/ActivityStatusPill';
import ActivityTokenIcon, { getActivityBadge } from '@/components/Activity/ActivityTokenIcon';
import CardActivityIcon from '@/components/Activity/CardActivityIcon';
import { CashbackDiamondIcon } from '@/components/Card/NewCardDetails/icons';
import CopyToClipboard from '@/components/CopyToClipboard';
import DepositStepper from '@/components/DepositStepper';
import EstimatedTime from '@/components/EstimatedTime';
import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Underline } from '@/components/ui/underline';
import { path } from '@/constants/path';
import { getTransactionCategory, TRANSACTION_DETAILS } from '@/constants/transaction';
import { useActivity } from '@/hooks/useActivity';
import useCancelOnchainWithdraw from '@/hooks/useCancelOnchainWithdraw';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardTransactionFromList } from '@/hooks/useCardTransactions';
import { useCashbacks } from '@/hooks/useCashbacks';
import { useTransactionReceiptPolling } from '@/hooks/useTransactionReceiptPolling';
import { fetchActivityEvent, getCardTransaction } from '@/lib/api';
import getTokenIcon from '@/lib/getTokenIcon';
import {
  CardProvider,
  CardTransaction,
  CardTransactionCategory,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@/lib/types';
import { cn, eclipseAddress, formatNumber, toTitleCase, withRefreshToken } from '@/lib/utils';
import {
  cardSweepExplorerUrl,
  cardTransactionExplorerUrl,
  formatCardAmount,
  formatCardTransactionAmount,
  getCardFeeInfo,
  getCardMerchantMapsUrl,
  getCardMerchantPlace,
  getCashbackAmount,
  isOutgoingCardTransaction,
} from '@/lib/utils/cardHelpers';
import {
  getDepositProgressRows,
  isDepositWithSteps,
  isSavingsDestination,
} from '@/lib/utils/deposit-steps';
import { getMerchantCategory } from '@/lib/utils/merchantCategory';
import { openSupportDrawer } from '@/store/useSupportDrawerStore';

type RowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  isLast?: boolean;
};

type LabelProps = {
  children: React.ReactNode;
};

type ValueProps = {
  children: React.ReactNode;
  className?: string;
};

type BackProps = {
  title: string;
  className?: string;
};

type SupportSectionProps = {
  transactionContext?: string;
};

const DATE_FORMAT = "do MMM yyyy 'at' h:mm a";
const CARD_DATE_FORMAT = "MMM d yyyy 'at' h:mm a";

const Row = memo(function Row({ label, value, isLast }: RowProps) {
  return (
    <View
      className={cn(
        'flex-row items-center justify-between border-b border-[#2C2C2E] px-6 py-5',
        isLast && 'border-b-0',
      )}
    >
      {label}
      {value}
    </View>
  );
});

// Figma 21287:5858 puts both sides of a detail row at 16px. Written as an exact
// pixel size rather than `text-base`/`text-lg`, because the Tailwind scale is
// remapped on native (`text-base` is 20px there, `text-lg` 22px) and the design
// asks for the same 16px on every platform.
const ROW_TEXT = 'text-[16px]';
/** The same size and weight as `Value`, for the rows that draw their own text. */
const ROW_VALUE_TEXT = cn(ROW_TEXT, 'font-bold');

const Label = memo(function Label({ children }: LabelProps) {
  return <Text className={cn(ROW_TEXT, 'font-medium text-[#ACACAC]')}>{children}</Text>;
});

const Value = memo(function Value({ children, className }: ValueProps) {
  return <Text className={cn(ROW_TEXT, 'font-bold', className)}>{children}</Text>;
});

const EscrowTimeLeft = memo(function EscrowTimeLeft({ payoutAt }: { payoutAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const target = useMemo(() => new Date(payoutAt).getTime(), [payoutAt]);

  if (target - now <= 0) return <Value>Releasing soon</Value>;

  return <Value>{formatDistanceStrict(target, now)}</Value>;
});

const Back = memo(function Back({ title, className }: BackProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; from?: string }>();

  const handleBackPress = useCallback(() => {
    if (params.from === 'card') {
      router.replace(path.CARD_INFO);
      return;
    }
    // Just pop this detail off. A detail is opened from wherever the tapped row
    // lives — the Activity list, but also a coin page's recent activity — and
    // `dismissTo(ACTIVITY)` sent every one of those back to the Activity list
    // instead. That mounted the whole unfiltered list (every transaction, both
    // card tabs) on top of the screen the user was actually on, which is what
    // made backing out of a coin page's transaction slow enough to hang.
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Deep link / notification: there is no screen underneath, so land on the
    // Activity list rather than leaving the user on a dead end.
    const tabParam = params.tab ? `?tab=${params.tab}` : '';
    router.dismissTo(`${path.ACTIVITY}${tabParam}` as any);
  }, [params.from, params.tab, router]);

  return (
    <View className="relative flex-row items-center justify-center">
      <View className="absolute left-0">
        <BackButton onPress={handleBackPress} />
      </View>
      {/* Inset past the back button, which is positioned on top of this row: the
          title is now a merchant name on a card transaction, and those run long
          enough to reach under it. Two lines rather than one so a long merchant
          name still reads in full. */}
      <Text
        numberOfLines={2}
        className={cn('mx-14 text-center text-lg font-semibold text-white', className)}
      >
        {title}
      </Text>
    </View>
  );
});

const SupportSection = memo(function SupportSection({ transactionContext }: SupportSectionProps) {
  const handleSupportPress = useCallback(() => {
    openSupportDrawer(transactionContext);
  }, [transactionContext]);

  return (
    <View className="mt-6 items-center">
      <Pressable
        onPress={handleSupportPress}
        className="flex-row items-center gap-2 active:opacity-70 web:hover:opacity-80"
      >
        <SupportIcon width={18} height={18} />
        <Text className="text-sm text-white/70">
          Got question?{' '}
          <Underline
            inline
            textClassName="text-sm text-white/70"
            borderColor="rgba(255, 255, 255, 0.7)"
          >
            Click here
          </Underline>{' '}
          to talk with support
        </Text>
      </Pressable>
    </View>
  );
});

type CardTransactionDetailProps = {
  transaction: CardTransaction;
  cardProvider?: CardProvider | null;
};

type DetailCardProps = {
  rows: { key: string; label: React.ReactNode; value: React.ReactNode }[];
};

const DetailCard = memo(function DetailCard({ rows }: DetailCardProps) {
  if (!rows.length) return null;

  return (
    <View className="overflow-hidden rounded-twice bg-card">
      {rows.map((row, index) => (
        <Row key={row.key} label={row.label} value={row.value} isLast={index === rows.length - 1} />
      ))}
    </View>
  );
});

const ContactSupportCard = memo(function ContactSupportCard({
  transactionContext,
}: SupportSectionProps) {
  const handlePress = useCallback(() => {
    openSupportDrawer(transactionContext);
  }, [transactionContext]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      className="flex-row items-center justify-between rounded-twice bg-card p-5 active:opacity-70 web:transition-colors web:hover:bg-card-hover"
    >
      <View className="flex-row items-center gap-3">
        <MessagesSquare size={20} color="#FFFFFF" />
        <Text className="text-base font-medium text-white">Contact support</Text>
      </View>
      <ChevronRight size={18} color="#FFFFFF" />
    </Pressable>
  );
});

const CardTransactionDetail = memo(function CardTransactionDetail({
  transaction,
  cardProvider,
}: CardTransactionDetailProps) {
  const merchantName =
    transaction.merchant_name?.trim() || transaction.description?.trim() || 'Unknown';
  const merchantPlace = useMemo(() => getCardMerchantPlace(transaction), [transaction]);
  // Numeric MCC first; issuers that name the category instead (Wirex) send the
  // label ready to show, and there is no code for the lookup to resolve.
  const merchantCategory =
    getMerchantCategory(transaction.merchant_category_code) ?? transaction.merchant_category_label;
  // A purchase takes money, so it reads with a minus — the stored sign is the
  // ledger's and says the opposite. See `isOutgoingCardTransaction`.
  const isOutgoing = isOutgoingCardTransaction(transaction);
  const { data: cashbacks } = useCashbacks();
  const { data: cardDetails } = useCardDetails();
  const last4 = cardDetails?.card_details?.last_4;

  const txHash = transaction.crypto_transaction_details?.tx_hash;
  const explorerUrl = cardTransactionExplorerUrl(transaction.crypto_transaction_details);
  // Our own settlement of the purchase: the soUSD that left the user's Safe on
  // Fuse to reimburse the issuer. Only cards that spend against savings have one.
  // The dollar equivalent of a foreign charge. Suppressed when the card was
  // charged in dollars already, where it would just repeat the line above it.
  // Signed to follow the charge rather than itself: it is stored unsigned.
  const usdEquivalent = useMemo(() => {
    const code = transaction.currency?.trim().toUpperCase();
    if (!transaction.usd_amount || !code || code === 'USD') return undefined;
    return formatCardTransactionAmount(transaction.usd_amount, isOutgoing, cardProvider);
  }, [transaction.usd_amount, transaction.currency, cardProvider, isOutgoing]);

  const spend = transaction.spend_details;
  const sweepHash = spend?.sweep_tx_hash;
  const sweepUrl = cardSweepExplorerUrl(spend);
  const isApproved = transaction.status === 'approved';
  const isDeclined = transaction.status === 'declined';
  const isReversed = transaction.status === 'reversed';
  const postedDate = useMemo(() => {
    const dateStr = isApproved
      ? transaction.authorized_at || transaction.posted_at
      : transaction.posted_at || transaction.authorized_at;
    return dateStr ? new Date(dateStr) : new Date();
  }, [isApproved, transaction.authorized_at, transaction.posted_at]);

  // Support needs the ledger side to trace a purchase whose sweep is stuck or
  // failed; none of it is worth a row on screen, but all of it belongs in the
  // message the user sends.
  const spendContext = useMemo(() => {
    if (!spend) return '';
    const lines = [
      transaction.usd_amount && `USD value: ${transaction.usd_amount}`,
      spend.so_usd_amount && `soUSD: ${spend.so_usd_amount}`,
      spend.state && `Settlement: ${spend.state}`,
      sweepHash && `Sweep: ${sweepHash}`,
    ].filter(Boolean);
    return lines.length ? `\n${lines.join('\n')}` : '';
  }, [spend, sweepHash, transaction.usd_amount]);

  const transactionContext = useMemo(
    () =>
      `Question about card transaction:\n\nMerchant: ${merchantName}\nAmount: ${formatCardTransactionAmount(transaction.amount, isOutgoing, cardProvider, transaction.currency)}\nDate: ${format(postedDate, DATE_FORMAT)}\nTransaction ID: card-${transaction.id}${spendContext}\n\nMy question: `,
    [
      merchantName,
      transaction.amount,
      transaction.currency,
      transaction.id,
      postedDate,
      isOutgoing,
      cardProvider,
      spendContext,
    ],
  );

  const handleExplorerPress = useCallback(() => {
    if (explorerUrl) Linking.openURL(explorerUrl);
  }, [explorerUrl]);

  const handleSweepPress = useCallback(() => {
    if (sweepUrl) Linking.openURL(sweepUrl);
  }, [sweepUrl]);

  const handleLocationPress = useCallback(() => {
    if (!merchantPlace) return;
    Linking.openURL(getCardMerchantMapsUrl(merchantPlace, transaction.merchant_name));
  }, [merchantPlace, transaction.merchant_name]);

  const cashbackInfo = getCashbackAmount(transaction.id, cashbacks);
  const feeInfo = getCardFeeInfo(transaction);
  const localDetails = transaction.local_transaction_details;

  const statusLabel = isApproved
    ? 'Pending'
    : isDeclined
      ? 'Declined'
      : isReversed
        ? 'Reversed'
        : 'Confirmed';
  // Declined never reaches this: it is drawn as a chip in the header instead.
  const statusColor = isApproved ? 'text-yellow-500' : '';

  const merchantRows = useMemo(
    () =>
      [
        {
          key: 'from',
          label: <Label>Sent from</Label>,
          value: (
            <View className="flex-row items-center gap-2">
              <CreditCard size={20} color="#FFFFFF" />
              <Value>{last4 ? `****${last4}` : 'Card'}</Value>
            </View>
          ),
        },
        merchantPlace && {
          key: 'location',
          label: <Label>Location</Label>,
          // The design draws this like any other value, so the tap is left
          // undecorated rather than turned into a link: nothing is lost if it
          // goes unnoticed, and an underline here would read as the only
          // navigable row in a card of plain facts.
          value: (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${merchantPlace.address} in Google Maps`}
              onPress={handleLocationPress}
              className="active:opacity-70 web:hover:opacity-80"
            >
              <Value>{merchantPlace.label}</Value>
            </Pressable>
          ),
        },
        merchantCategory && {
          key: 'category',
          label: <Label>Category</Label>,
          value: <Value>{merchantCategory}</Value>,
        },
      ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[],
    [last4, merchantPlace, merchantCategory, handleLocationPress],
  );

  const rows = useMemo(() => {
    const allRows = [
      // The chip in the header already says "Declined", and louder than a row
      // in a card of plain facts can.
      !isDeclined && {
        key: 'status',
        label: <Label>Status</Label>,
        value: <Value className={statusColor}>{statusLabel}</Value>,
      },
      isDeclined &&
        transaction.declined_reason && {
          key: 'reason',
          label: <Label>Reason</Label>,
          // Wraps rather than truncates — a decline reason is the one value on
          // this screen the user has to read in full. No size of its own: it
          // used to step down from `text-lg` to `text-base`, and now every value
          // on the card is already the 16px that step was reaching for.
          value: (
            <Value className="max-w-[60%] text-right">
              {toTitleCase(transaction.declined_reason)}
            </Value>
          ),
        },
      cashbackInfo && {
        key: 'cashback',
        // The label is green on both sides of the design (Figma 21287:5858):
        // what the user earned back reads as a gain, not as another fact about
        // the charge.
        label: (
          <View className="flex-row items-center gap-1.5">
            <CashbackDiamondIcon size={14} />
            <Text className={cn(ROW_TEXT, 'font-medium text-brand')}>Cashback</Text>
          </View>
        ),
        // The figure earns its green only once the payout has landed. Until
        // then it is a projection, and it carries no "(Escrowed)" or
        // "(Pending)" of its own — the "Releases in" row below already says the
        // money is still on its way, and saying so twice on one receipt reads
        // as a warning about the amount rather than a note about its timing.
        value: (
          <Value className={cashbackInfo.isPaid ? 'text-brand' : undefined}>
            {cashbackInfo.amount ?? (cashbackInfo.isEscrowed ? 'Escrowed' : 'Pending')}
          </Value>
        ),
      },
      cashbackInfo?.isEscrowed &&
        cashbackInfo.payoutAt && {
          key: 'cashback-escrow-time-left',
          label: <Label>Releases in</Label>,
          value: <EscrowTimeLeft payoutAt={cashbackInfo.payoutAt} />,
        },
      // A refund the issuer folded into this transaction rather than sending as
      // its own (Wirex). The amount above is already net of it, so without this
      // row the figure silently disagrees with the receipt in the user's hand.
      transaction.refunded_amount && {
        key: 'refunded',
        label: <Label>Refunded</Label>,
        value: (
          <Value className="text-brand">
            {formatCardAmount(transaction.refunded_amount, cardProvider, transaction.currency)}
          </Value>
        ),
      },
      // What the merchant actually charged, shown right above the FX fee so the
      // fee has a visible cause rather than looking like an unexplained charge.
      localDetails?.amount &&
        localDetails.currency && {
          key: 'local-amount',
          label: <Label>Charged in</Label>,
          value: (
            <Value>
              {localDetails.amount} {localDetails.currency.toUpperCase()}
            </Value>
          ),
        },
      feeInfo && {
        key: 'card-fee',
        label: (
          <Label>
            {feeInfo.label}
            {feeInfo.rate ? ` (${feeInfo.rate})` : ''}
          </Label>
        ),
        value: (
          <Value className={feeInfo.isWaived ? 'text-brand' : ''}>
            {feeInfo.isWaived
              ? feeInfo.waivedNote || 'Free'
              : feeInfo.isPending
                ? `${feeInfo.amount} (Pending)`
                : feeInfo.amount}
          </Value>
        ),
      },
      // What the purchase actually cost the user in their own asset. The figure
      // above is what the merchant charged; this is what left the wallet to
      // cover it, and the two are in different units.
      spend?.so_usd_amount && {
        key: 'sousd-paid',
        label: <Label>Paid with</Label>,
        value: <Value>{formatNumber(Number(spend.so_usd_amount), 4)} soUSD</Value>,
      },
      spend?.so_usd_rate !== undefined && {
        key: 'sousd-rate',
        label: <Label>soUSD price</Label>,
        value: <Value>${formatNumber(spend.so_usd_rate, 4)}</Value>,
      },
      sweepUrl &&
        sweepHash && {
          key: 'sweep',
          label: <Label>Sweep</Label>,
          value: (
            <Pressable onPress={handleSweepPress} className="hover:opacity-70">
              <View className="flex-row items-center gap-1">
                <Underline textClassName={ROW_VALUE_TEXT} borderColor="rgba(255, 255, 255, 1)">
                  {eclipseAddress(sweepHash)}
                </Underline>
                <ArrowUpRight color="white" size={16} />
              </View>
            </Pressable>
          ),
        },
      txHash && {
        key: 'explorer',
        label: <Label>Explorer</Label>,
        value: (
          <Pressable onPress={handleExplorerPress} className="hover:opacity-70">
            <View className="flex-row items-center gap-1">
              <Underline textClassName={ROW_VALUE_TEXT} borderColor="rgba(255, 255, 255, 1)">
                {eclipseAddress(txHash)}
              </Underline>
              <ArrowUpRight color="white" size={16} />
            </View>
          </Pressable>
        ),
      },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];

    return allRows;
  }, [
    cashbackInfo,
    feeInfo,
    localDetails,
    txHash,
    handleExplorerPress,
    statusLabel,
    statusColor,
    isDeclined,
    cardProvider,
    spend,
    sweepUrl,
    sweepHash,
    handleSweepPress,
    transaction.currency,
    transaction.declined_reason,
    transaction.refunded_amount,
  ]);

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-6 px-4 py-8 pb-32 md:py-12">
        {/* The merchant is the title (Figma 21287:5858) — on a card transaction
            it is the one thing that identifies which purchase this is, and
            "Transaction details" was a heading the whole screen already implied. */}
        <Back title={merchantName} className="text-xl md:text-2xl" />

        <View className="items-center gap-4">
          {/* The card glyph, not the merchant's initial (Figma 21287:5884). The
              same icon the activity row leads with, so a tapped row and the
              screen it opens agree — and an initial said nothing the title above
              does not already say in full. */}
          <CardActivityIcon transaction={transaction} size={75} />

          <View className="items-center gap-1">
            <Text className="text-2xl font-bold text-white">
              {formatCardTransactionAmount(
                transaction.amount,
                isOutgoing,
                cardProvider,
                transaction.currency,
              )}
            </Text>
            {/* No "≈": the figure now carries a sign, and "≈ -$31.46" reads as
                two operators. The activity row shows the conversion bare too. */}
            {usdEquivalent && <Text className="text-base text-white/50">{usdEquivalent}</Text>}
            <Text className="text-base text-white/70">{format(postedDate, CARD_DATE_FORMAT)}</Text>
            {/* A decline reads as a chip, the same one the activity row uses
                (Figma 24781:7993), rather than as one more fact in the detail
                card below. It changes what every figure above it means — the
                money never left — so it belongs beside them, not in a list of
                properties the user has to read to find out the purchase never
                happened. The reason still gets its own row. */}
            {isDeclined && (
              // `self-center` overrides the pill's own `self-start`: on a row it
              // hangs off the merchant's left edge, here it sits under a centred
              // amount.
              <ActivityStatusPill label="Declined" tone="danger" className="mt-1 self-center" />
            )}
          </View>
        </View>

        <DetailCard rows={merchantRows} />
        <DetailCard rows={rows} />
        <ContactSupportCard transactionContext={transactionContext} />
      </View>
    </PageLayout>
  );
});

/**
 * A card transaction whose details neither source will give us.
 *
 * The issuer does not serve a single-transaction read for every row it puts in
 * the feed, and the feed itself can be a page too short or a request too far.
 * The user still tapped a purchase they can see on their statement, so this
 * stays the purchase's own screen rather than becoming an error page about it —
 * with the merchant, the figure and the date left out rather than invented,
 * because a made-up amount on a card transaction is worse than a missing one.
 */
const UnknownCardTransaction = memo(function UnknownCardTransaction({
  clientTxId,
}: {
  clientTxId: string;
}) {
  const transactionContext = useMemo(
    () =>
      `Question about card transaction:\n\nTransaction ID: ${clientTxId}\nThe app cannot load its details.\n\nMy question: `,
    [clientTxId],
  );

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 gap-6 px-4 py-8 pb-32 md:py-12">
        <Back title="Card transaction" className="text-xl md:text-2xl" />

        <View className="items-center gap-4">
          <CardActivityIcon
            transaction={{ category: CardTransactionCategory.PURCHASE, currency: '' }}
            size={75}
          />

          <View className="items-center gap-1">
            <Text className="text-center text-base text-white/70">
              We could not load the details of this purchase. Support can look it up for you.
            </Text>
            <Text className="text-sm text-white/40">{eclipseAddress(clientTxId)}</Text>
          </View>
        </View>

        <ContactSupportCard transactionContext={transactionContext} />
      </View>
    </PageLayout>
  );
});

const formatSymbol = (symbol?: string) => (symbol?.toLowerCase() === 'sousd' ? 'soUSD' : symbol);

export default function ActivityDetail() {
  const { clientTxId } = useLocalSearchParams<{ clientTxId: string }>();
  const { cancelOnchainWithdraw } = useCancelOnchainWithdraw();
  const [currentTime, setCurrentTime] = useState(minutesToSeconds(5));
  const { cachedActivities, isLoading: isActivitiesLoading } = useActivity();
  const { provider: cardProvider } = useCardProvider();

  const activity = useMemo(
    () =>
      cachedActivities.find(
        a => a.clientTxId === clientTxId || a.hash === clientTxId || a.userOpHash === clientTxId,
      ),
    [cachedActivities, clientTxId],
  );

  // Check if this is a card transaction
  const isCardTransaction = clientTxId?.startsWith('card-');
  const cardTxId = isCardTransaction ? clientTxId.replace('card-', '') : null;

  // Fetch card transaction from API
  const { data: cardTransaction, isLoading: isCardTransactionLoading } = useQuery({
    queryKey: ['card-transaction', cardTxId],
    queryFn: () => withRefreshToken(() => getCardTransaction(cardTxId!)),
    enabled: !!cardTxId,
  });

  // The feed row, for the transactions the issuer will not serve on their own —
  // a declined Wirex purchase 404s the single-activity read, and this screen
  // used to answer that with "Transaction … not found" about a transaction the
  // user was looking at a tap earlier. The row carries the merchant, amount,
  // currency, status and decline reason, which is everything below except the
  // fees and our own ledger's view.
  const { transaction: listCardTransaction, isFetching: isCardListFetching } =
    useCardTransactionFromList(cardTxId, {
      fetchIfMissing: !!cardTxId && !cardTransaction && !isCardTransactionLoading,
    });

  const cardTransactionDetail = cardTransaction ?? listCardTransaction;

  // Fetch from backend if not found in cache (fallback for activities not yet loaded)
  const { data: backendActivity, isLoading: isBackendLoading } = useQuery({
    queryKey: ['activity-event', clientTxId],
    queryFn: () => withRefreshToken(() => fetchActivityEvent(clientTxId)),
    enabled: !activity && !isActivitiesLoading && !!clientTxId && !isCardTransaction,
  });

  const finalActivity = activity || backendActivity;

  // Poll blockchain for receipt when activity is stuck at PROCESSING
  useTransactionReceiptPolling(finalActivity);

  // Check if backend query should be loading but hasn't started yet
  const isBackendQueryPending =
    !activity && !isActivitiesLoading && !!clientTxId && !isCardTransaction && !backendActivity;
  const isAnyLoading =
    isActivitiesLoading ||
    isBackendLoading ||
    isCardTransactionLoading ||
    isCardListFetching ||
    isBackendQueryPending;

  const isDeposit = finalActivity?.type === TransactionType.DEPOSIT;
  const chainId = finalActivity?.chainId;
  const isEthereum = chainId === mainnet.id;
  const symbolLower = finalActivity?.symbol?.toLowerCase();
  const metaInput = finalActivity?.metadata?.inputToken?.toLowerCase();
  const metaOutput = finalActivity?.metadata?.outputToken?.toLowerCase();
  const isFuseVaultDepositSymbol = (s?: string) => s === 'wfuse' || s === 'sofuse' || s === 'fuse';
  const isFuseChain = Number(chainId) === 122;
  const isSoFuseOnFuse =
    isFuseChain &&
    (isFuseVaultDepositSymbol(symbolLower) ||
      isFuseVaultDepositSymbol(metaInput) ||
      isFuseVaultDepositSymbol(metaOutput));

  const createdAt = useMemo(
    () => (finalActivity?.timestamp ? new Date(Number(finalActivity.timestamp) * 1000) : null),
    [finalActivity?.timestamp],
  );

  const isFund = finalActivity?.type === TransactionType.FUND;

  const estimatedDurationSeconds = useMemo(() => {
    if (isFund) return minutesToSeconds(2);
    if (isEthereum) return minutesToSeconds(5);
    if (isSoFuseOnFuse) return minutesToSeconds(2);
    return minutesToSeconds(20);
  }, [isFund, isEthereum, isSoFuseOnFuse]);

  useEffect(() => {
    if (!finalActivity || !(isDeposit || isFund) || !createdAt) return;

    const elapsedSeconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);
    setCurrentTime(Math.max(0, estimatedDurationSeconds - elapsedSeconds));
  }, [finalActivity, isDeposit, isFund, createdAt, estimatedDurationSeconds]);

  const transactionDetails = finalActivity ? TRANSACTION_DETAILS[finalActivity.type] : null;
  const activityBadge = getActivityBadge(finalActivity?.type);

  // Report unknown transaction types
  useEffect(() => {
    if (!finalActivity || transactionDetails) return;

    const errorData = {
      clientTxId,
      title: finalActivity.title,
      amount: finalActivity.amount,
      status: finalActivity.status,
      symbol: finalActivity.symbol,
    };

    Sentry.captureException(new Error(`Unknown transaction type: ${finalActivity.type}`), {
      tags: {
        type: 'unknown_transaction_type',
        transaction_type: finalActivity.type,
        screen: 'activity_detail',
      },
      extra: errorData,
    });
  }, [finalActivity, transactionDetails, clientTxId]);

  const isFailed = finalActivity?.status === TransactionStatus.FAILED;
  const isCancelled = finalActivity?.status === TransactionStatus.CANCELLED;
  const isPending = finalActivity?.status === TransactionStatus.PENDING;
  const isDetected = finalActivity?.status === TransactionStatus.DETECTED;
  const isProcessing = finalActivity?.status === TransactionStatus.PROCESSING;
  const isIncoming = transactionDetails?.sign === TransactionDirection.IN;
  // Deposits denominated in a share token, i.e. a mint into savings. soETH was
  // missing here, so soETH deposits rendered as outgoing wallet deposits.
  const isSavingsDeposit =
    isDeposit && (symbolLower === 'sousd' || symbolLower === 'sofuse' || symbolLower === 'soeth');
  const isSuccess = finalActivity?.status === TransactionStatus.SUCCESS;
  const hideSavingsAmount =
    isSavingsDeposit && (isPending || isProcessing || (isSuccess && !finalActivity?.hash));
  const isCancelWithdraw = finalActivity?.requestId && isPending;

  const isBridgeDeposit = finalActivity?.type === TransactionType.BRIDGE_DEPOSIT;

  const statusTextColor = useMemo(() => {
    if (isFailed) return 'text-red-400';
    if (isCancelled) return '';
    if (isIncoming || isSavingsDeposit) return 'text-brand';
    return '';
  }, [isFailed, isCancelled, isIncoming, isSavingsDeposit]);

  const statusSign = useMemo(() => {
    if (isFailed) return TransactionDirection.FAILED;
    if (isCancelled) return TransactionDirection.CANCELLED;
    if (isDeposit) return isSavingsDeposit ? TransactionDirection.IN : TransactionDirection.FAILED;
    return transactionDetails?.sign ?? '';
  }, [isFailed, isCancelled, isDeposit, isSavingsDeposit, transactionDetails?.sign]);

  const description = useMemo(() => {
    if (finalActivity?.type === TransactionType.CARD_WITHDRAWAL) {
      return `${toTitleCase(finalActivity?.metadata?.destination || 'savings')} account`;
    }
    if (isDeposit && finalActivity?.status === TransactionStatus.SUCCESS) {
      return 'Complete';
    }
    if (!finalActivity) return 'Unknown';
    return getTransactionCategory(finalActivity.type, finalActivity.title) ?? 'Unknown';
  }, [finalActivity, isDeposit]);

  const tokenIcon = useMemo(
    () => (finalActivity ? getTokenIcon({ tokenSymbol: finalActivity.symbol, size: 75 }) : null),
    [finalActivity],
  );

  const handleCancelWithdraw = useCallback(async () => {
    if (!isCancelWithdraw || !finalActivity?.requestId) return;
    await cancelOnchainWithdraw(finalActivity.requestId);
  }, [isCancelWithdraw, finalActivity?.requestId, cancelOnchainWithdraw]);

  const handleExplorerPress = useCallback(() => {
    if (finalActivity?.url) Linking.openURL(finalActivity.url);
  }, [finalActivity?.url]);

  const rows = useMemo(() => {
    if (!finalActivity) return [];

    const { fromAddress, toAddress, status, metadata, url, hash } = finalActivity;

    return [
      fromAddress && {
        key: 'from',
        label: <Label>Sent from</Label>,
        value: (
          <View className="flex-row items-center gap-1">
            <Value>{eclipseAddress(fromAddress)}</Value>
            <CopyToClipboard text={fromAddress} />
          </View>
        ),
      },
      toAddress && {
        key: 'to',
        label: <Label>Recipient</Label>,
        value: (
          <View className="flex-row items-center gap-1">
            <Value>{eclipseAddress(toAddress)}</Value>
            <CopyToClipboard text={toAddress} />
          </View>
        ),
      },
      status && {
        key: 'status',
        label: <Label>Status</Label>,
        value: <Value>{toTitleCase(status)}</Value>,
      },
      metadata?.inputAmount &&
        metadata?.inputToken && {
          key: 'paid',
          label: <Label>Paid</Label>,
          value: (
            <Value>
              {metadata.inputAmount} {metadata.inputToken}
            </Value>
          ),
        },
      metadata?.outputAmount &&
        metadata?.outputToken && {
          key: 'received',
          label: <Label>Received</Label>,
          value: (
            <Value>
              {metadata.outputAmount} {metadata.outputToken}
            </Value>
          ),
        },
      url &&
        hash && {
          key: 'explorer',
          label: <Label>Explorer</Label>,
          value: (
            <Pressable onPress={handleExplorerPress} className="hover:opacity-70">
              <View className="flex-row items-center gap-1">
                <Underline textClassName={ROW_VALUE_TEXT} borderColor="rgba(255, 255, 255, 1)">
                  {eclipseAddress(hash)}
                </Underline>
                <ArrowUpRight color="white" size={16} />
              </View>
            </Pressable>
          ),
        },
      (isDeposit || isFund || isBridgeDeposit) &&
        (isPending || isDetected || isProcessing) && {
          key: 'estimated',
          label: <Label>Estimated time</Label>,
          value: <EstimatedTime currentTime={currentTime} setCurrentTime={setCurrentTime} />,
        },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];
  }, [
    finalActivity,
    isDeposit,
    isFund,
    isBridgeDeposit,
    isPending,
    isDetected,
    isProcessing,
    currentTime,
    handleExplorerPress,
  ]);

  // --- Deposit progress view (Figma: deposit transaction details) ---
  const isDepositDetail = !!finalActivity && isDepositWithSteps(finalActivity);

  const depositProgressRows = useMemo(
    () => (finalActivity && isDepositDetail ? getDepositProgressRows(finalActivity) : []),
    [finalActivity, isDepositDetail],
  );

  const depositDestination = useMemo(() => {
    if (!finalActivity) return { label: 'Wallet', isCard: false };
    // Diverted below the sponsor minimum: the deposit never reached the
    // originally-intended destination, so say where it actually landed.
    if (finalActivity.status === TransactionStatus.TRANSFERRED_TO_SAFE) {
      return { label: 'Safe', isCard: false };
    }
    if (finalActivity.metadata?.destinationType === 'RAIN_CARD') {
      return { label: 'Card', isCard: true };
    }
    // Not `isSavingsDeposit`: that is symbol-based (it also gates hiding the
    // amount until a mint lands), and a savings direct deposit is denominated in
    // the token that was sent, not in the share token it mints.
    return {
      label: isSavingsDestination(finalActivity) ? 'Savings' : 'Wallet',
      isCard: false,
    };
  }, [finalActivity]);

  const depositStatus = useMemo(() => {
    if (isFailed) return { label: 'Failed', className: 'text-red-400' };
    if (isCancelled) return { label: 'Cancelled', className: 'text-muted-foreground' };
    if (isSuccess) return { label: 'Completed', className: 'text-brand' };
    if (isPending || isDetected || isProcessing) {
      return { label: 'Processing', className: 'text-[#ECDC76]' };
    }
    if (finalActivity?.status === TransactionStatus.TRANSFERRED_TO_SAFE) {
      return { label: 'Sent to Safe', className: 'text-brand' };
    }
    // REFUNDED / EXPIRED and anything added later keep their own wording
    return {
      label: toTitleCase(finalActivity?.status ?? ''),
      className: 'text-muted-foreground',
    };
  }, [
    isFailed,
    isCancelled,
    isSuccess,
    isPending,
    isDetected,
    isProcessing,
    finalActivity?.status,
  ]);

  const depositTransferRows = useMemo(() => {
    if (!finalActivity) return [];

    return [
      finalActivity.fromAddress && {
        key: 'from',
        label: <Label>Sent from</Label>,
        value: (
          <View className="flex-row items-center gap-1">
            <Value>{eclipseAddress(finalActivity.fromAddress)}</Value>
            <CopyToClipboard text={finalActivity.fromAddress} />
          </View>
        ),
      },
      {
        key: 'to',
        label: <Label>Sent to</Label>,
        value: (
          <View className="flex-row items-center gap-2">
            {depositDestination.isCard ? (
              <CreditCard size={18} color="#FFFFFF" />
            ) : (
              <Wallet size={18} color="#FFFFFF" />
            )}
            <Value>{depositDestination.label}</Value>
          </View>
        ),
      },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];
  }, [finalActivity, depositDestination]);

  const depositStatusRows = useMemo(() => {
    if (!finalActivity) return [];

    const { url, hash, metadata } = finalActivity;
    const isInProgress = isPending || isDetected || isProcessing;

    return [
      {
        key: 'status',
        label: <Label>Status</Label>,
        value: <Value className={depositStatus.className}>{depositStatus.label}</Value>,
      },
      isInProgress && {
        key: 'estimated',
        label: <Label>Estimated time</Label>,
        value: <EstimatedTime currentTime={currentTime} setCurrentTime={setCurrentTime} />,
      },
      metadata?.inputAmount &&
        metadata?.inputToken && {
          key: 'paid',
          label: <Label>Paid</Label>,
          value: (
            <Value>
              {metadata.inputAmount} {metadata.inputToken}
            </Value>
          ),
        },
      metadata?.outputAmount &&
        metadata?.outputToken && {
          key: 'received',
          label: <Label>Received</Label>,
          value: (
            <Value>
              {metadata.outputAmount} {metadata.outputToken}
            </Value>
          ),
        },
      {
        key: 'fee',
        label: <Label>Fee</Label>,
        value: <Value>No fees</Value>,
      },
      url &&
        hash && {
          key: 'explorer',
          label: <Label>Explorer</Label>,
          value: (
            <Pressable onPress={handleExplorerPress} className="hover:opacity-70">
              <View className="flex-row items-center gap-1">
                <Underline textClassName={ROW_VALUE_TEXT} borderColor="rgba(255, 255, 255, 1)">
                  {eclipseAddress(hash)}
                </Underline>
                <ArrowUpRight color="white" size={16} />
              </View>
            </Pressable>
          ),
        },
    ].filter(Boolean) as { key: string; label: React.ReactNode; value: React.ReactNode }[];
  }, [
    finalActivity,
    depositStatus,
    isPending,
    isDetected,
    isProcessing,
    currentTime,
    handleExplorerPress,
  ]);

  const transactionContext = useMemo(() => {
    if (!finalActivity) return '';
    return `Question about transaction:\n\nTitle: ${finalActivity.title}\nAmount: ${statusSign}${formatNumber(Number(finalActivity.amount))} ${formatSymbol(finalActivity.symbol)}\nStatus: ${toTitleCase(finalActivity.status)}\nDate: ${format(Number(finalActivity.timestamp) * 1000, DATE_FORMAT)}\nTransaction ID: ${clientTxId}\n\nMy question: `;
  }, [finalActivity, statusSign, clientTxId]);

  const missingTransactionContext = useMemo(
    () =>
      `Question about transaction:\n\nTransaction ID: ${clientTxId}\nI cannot open its details in the app.\n\nMy question: `,
    [clientTxId],
  );

  // Show loading if clientTxId is not ready
  if (!clientTxId) {
    return (
      <PageLayout desktopOnly isLoading>
        <View />
      </PageLayout>
    );
  }

  // Card transaction. Rendered as soon as either source has it rather than once
  // the single read settles: the feed row is enough to draw the whole header,
  // and waiting on a read that may never return it is what produced the
  // not-found screen.
  if (isCardTransaction && cardTransactionDetail) {
    return (
      <CardTransactionDetail transaction={cardTransactionDetail} cardProvider={cardProvider} />
    );
  }

  // Loading
  if (!finalActivity && isAnyLoading) {
    return (
      <PageLayout desktopOnly isLoading>
        <View />
      </PageLayout>
    );
  }

  // A card transaction keeps its own screen even with nothing to put on it: the
  // user tapped a purchase that exists — they can see it on the feed, or on
  // their statement — so an error page about it would be the app arguing with
  // them. See `UnknownCardTransaction`.
  if (isCardTransaction) {
    return <UnknownCardTransaction clientTxId={clientTxId} />;
  }

  // Not found. A wallet activity that neither the activity store nor the
  // backend read knows about, which unlike a card transaction means there is
  // genuinely no such transaction to show. A bare title left the user on a
  // screen that named an id and explained nothing, so the id moves into the
  // body and support is one tap away.
  if (!finalActivity) {
    return (
      <PageLayout desktopOnly>
        <View className="mx-auto w-full max-w-lg gap-8 px-4 py-8 md:gap-16 md:py-12">
          <Back title="Transaction not found" />

          <View className="items-center gap-2">
            <Text className="text-center text-base text-white/70">
              We could not load this transaction. It may still be settling — try again from the
              activity list in a moment.
            </Text>
            <Text className="text-center text-sm text-white/40">{eclipseAddress(clientTxId)}</Text>
          </View>

          <SupportSection transactionContext={missingTransactionContext} />
        </View>
      </PageLayout>
    );
  }

  // Deposit: progress-stepper layout
  if (isDepositDetail) {
    const showStepper =
      !isCancelled &&
      finalActivity.status !== TransactionStatus.REFUNDED &&
      finalActivity.status !== TransactionStatus.TRANSFERRED_TO_SAFE &&
      finalActivity.status !== TransactionStatus.EXPIRED;
    const depositSign = isFailed
      ? TransactionDirection.FAILED
      : isCancelled
        ? TransactionDirection.CANCELLED
        : TransactionDirection.IN;

    return (
      <PageLayout desktopOnly isLoading={isAnyLoading}>
        <View className="mx-auto w-full max-w-lg flex-1 gap-6 px-4 py-8 pb-32 md:py-12">
          <Back title={finalActivity.title} className="text-xl md:text-2xl" />

          <View className="items-center gap-4">
            {tokenIcon && (
              <ActivityTokenIcon
                tokenIcon={tokenIcon}
                size={72}
                badge="incoming"
                variant="detail"
              />
            )}

            <View className="items-center gap-1">
              {hideSavingsAmount ? (
                isSuccess && (
                  <Text className="text-lg font-semibold text-muted-foreground">
                    Confirming amount...
                  </Text>
                )
              ) : (
                <Text className={cn('text-2xl font-bold text-white', isFailed && 'text-red-400')}>
                  {depositSign}
                  {formatNumber(Number(finalActivity.amount))} {formatSymbol(finalActivity.symbol)}
                </Text>
              )}
              <Text className="text-base text-white/70">
                {format(Number(finalActivity.timestamp) * 1000, CARD_DATE_FORMAT)}
              </Text>
            </View>
          </View>

          {showStepper && depositProgressRows.length > 0 && (
            <DepositStepper rows={depositProgressRows} />
          )}

          <DetailCard rows={depositTransferRows} />
          <DetailCard rows={depositStatusRows} />
          <ContactSupportCard transactionContext={transactionContext} />
        </View>
      </PageLayout>
    );
  }

  return (
    <PageLayout desktopOnly isLoading={isAnyLoading}>
      <View className="mx-auto w-full max-w-lg flex-1 gap-10 px-4 py-8 pb-32 md:py-12">
        <Back title={finalActivity.title} className="text-xl md:text-3xl" />

        <View className="items-center gap-4">
          {tokenIcon &&
            (activityBadge ? (
              <ActivityTokenIcon
                tokenIcon={tokenIcon}
                size={75}
                badge={activityBadge}
                variant="detail"
              />
            ) : (
              <RenderTokenIcon tokenIcon={tokenIcon} size={75} />
            ))}

          <View className="items-center">
            {hideSavingsAmount ? (
              isSuccess && (
                <Text className="text-lg font-semibold text-muted-foreground">
                  Confirming amount...
                </Text>
              )
            ) : (
              <Text className={cn('text-2xl font-bold', statusTextColor)}>
                {statusSign}
                {formatNumber(Number(finalActivity.amount))} {formatSymbol(finalActivity.symbol)}
              </Text>
            )}
            <Text className="mt-2 font-semibold text-muted-foreground">{description}</Text>
            <Text className="font-semibold text-muted-foreground">
              {format(Number(finalActivity.timestamp) * 1000, DATE_FORMAT)}
            </Text>
          </View>
        </View>

        <View className="rounded-twice bg-card">
          {rows.map((row, index) => (
            <Row
              key={row.key}
              label={row.label}
              value={row.value}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>

        {isCancelWithdraw && (
          <Button
            onPress={handleCancelWithdraw}
            variant="secondary"
            className="h-14 rounded-xl border-0"
          >
            <X color="white" size={16} />
            <Text className="text-base">Cancel Withdraw</Text>
          </Button>
        )}

        <SupportSection transactionContext={transactionContext} />
      </View>
    </PageLayout>
  );
}
