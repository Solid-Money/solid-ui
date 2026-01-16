import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { ChevronRight, Copy, Plus } from 'lucide-react-native';

import AddToWalletModal from '@/components/Card/AddToWalletModal';
import { CircularActionButton } from '@/components/Card/CircularActionButton';
import DepositToCardModal from '@/components/Card/DepositToCardModal';
import Loading from '@/components/Loading';
import PageLayout from '@/components/PageLayout';
import RenderTokenIcon from '@/components/RenderTokenIcon';
import TransactionDrawer from '@/components/Transaction/TransactionDrawer';
import TransactionDropdown from '@/components/Transaction/TransactionDropdown';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useDimension } from '@/hooks/useDimension';
import { freezeCard, unfreezeCard } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardHolderName, CardStatus, CardTransaction } from '@/lib/types';
import {
  formatCardAmountWithCurrency,
  getColorForTransaction,
  getInitials,
} from '@/lib/utils/cardHelpers';
import { cn } from '@/lib/utils/utils';

export default function CardDetails() {
  const { data: cardDetails, isLoading, refetch } = useCardDetails();
  const { isScreenMedium } = useDimension();
  const [isFreezing, setIsFreezing] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [shouldRevealDetails, setShouldRevealDetails] = useState(false);
  const [isAddToWalletModalOpen, setIsAddToWalletModalOpen] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;

  const {
    data: transactionsData,
    isLoading: isLoadingTransactions,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCardTransactions();

  const availableBalance = cardDetails?.balances.available;
  const availableAmount = Number(availableBalance?.amount || '0').toString();
  const isCardFrozen = cardDetails?.status === CardStatus.FROZEN;

  const handleFreezeToggle = useCallback(async () => {
    try {
      setIsFreezing(true);
      if (isCardFrozen) {
        await unfreezeCard();
      } else {
        await freezeCard();
      }
      await refetch();
    } catch (_error) {
      Alert.alert(
        'Error',
        `Failed to ${isCardFrozen ? 'unfreeze' : 'freeze'} card. Please try again.`,
      );
    } finally {
      setIsFreezing(false);
    }
  }, [isCardFrozen, refetch]);

  const handleCardFlip = useCallback(() => {
    if (isCardFlipped) {
      // Flip back to front
      Animated.spring(flipAnimation, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsCardFlipped(false);
      setShouldRevealDetails(false);
    } else {
      // Start loading and trigger reveal
      setIsLoadingCardDetails(true);
      setShouldRevealDetails(true);
    }
  }, [isCardFlipped, flipAnimation]);

  const handleCardDetailsLoaded = useCallback(() => {
    // Once data is loaded, flip the card immediately
    setIsLoadingCardDetails(false);
    setIsCardFlipped(true);

    Animated.spring(flipAnimation, {
      toValue: 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  }, [flipAnimation]);

  // Desktop layout
  if (isScreenMedium) {
    return (
      <PageLayout desktopOnly isLoading={isLoading}>
        <View className="mx-auto w-full max-w-7xl px-4 py-12">
          {/* Desktop Header */}
          <DesktopHeader
            isCardFrozen={isCardFrozen}
            isFreezing={isFreezing}
            isCardFlipped={isCardFlipped}
            isLoadingCardDetails={isLoadingCardDetails}
            onCardDetails={handleCardFlip}
            onFreezeToggle={handleFreezeToggle}
          />

          {/* Row 1: Spending Balance Card + Card Image */}
          <View className="mt-12 flex-row gap-6">
            <View className="flex-[3]">
              <SpendingBalanceCard amount={availableAmount} cashback={cardDetails?.cashback} />
            </View>
            <View className="flex-[2]">
              <CardImageSection
                isScreenMedium={isScreenMedium}
                isCardFrozen={isCardFrozen}
                flipAnimation={flipAnimation}
                isCardFlipped={isCardFlipped}
                cardholderName={cardDetails?.cardholder_name}
                shouldRevealDetails={shouldRevealDetails}
                onCardDetailsLoaded={handleCardDetailsLoaded}
              />
            </View>
          </View>

          {/* Row 2: Bonus Banner + Add to Wallet (same height) */}
          <View className="mt-4 flex-row gap-6">
            <View className="flex-[3]">
              <DepositBonusBanner />
            </View>
            <View className="flex-[2]">
              <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
            </View>
          </View>

          {/* Recent Transactions */}
          <RecentTransactions
            transactions={transactionsData?.pages.flatMap(page => page.data) ?? []}
            isLoading={isLoadingTransactions}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
          />
        </View>

        <AddToWalletModal
          isOpen={isAddToWalletModalOpen}
          onOpenChange={setIsAddToWalletModalOpen}
          trigger={null}
        />
      </PageLayout>
    );
  }

  // Mobile layout (unchanged)
  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-lg px-4 pt-6">
        <MobileHeader />

        <View className="flex-1">
          <BalanceDisplay amount={availableAmount} />
          <CardImageSection
            isScreenMedium={isScreenMedium}
            isCardFrozen={isCardFrozen}
            flipAnimation={flipAnimation}
            isCardFlipped={isCardFlipped}
            cardholderName={cardDetails?.cardholder_name}
            shouldRevealDetails={shouldRevealDetails}
            onCardDetailsLoaded={handleCardDetailsLoaded}
          />
          <CardActions
            isCardFrozen={isCardFrozen}
            isFreezing={isFreezing}
            isCardFlipped={isCardFlipped}
            isLoadingCardDetails={isLoadingCardDetails}
            onCardDetails={handleCardFlip}
            onFreezeToggle={handleFreezeToggle}
          />
          <DepositBonusBanner />
          <CashbackDisplay cashback={cardDetails?.cashback} />
          <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
          <RecentTransactions
            transactions={transactionsData?.pages.flatMap(page => page.data) ?? []}
            isLoading={isLoadingTransactions}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
            onLoadMore={fetchNextPage}
          />
        </View>
      </View>

      <AddToWalletModal
        isOpen={isAddToWalletModalOpen}
        onOpenChange={setIsAddToWalletModalOpen}
        trigger={null}
      />
    </PageLayout>
  );
}

function MobileHeader() {
  return <Text className="text-3xl font-semibold">Card</Text>;
}

interface DesktopHeaderProps {
  isCardFrozen: boolean;
  isFreezing: boolean;
  isCardFlipped: boolean;
  isLoadingCardDetails: boolean;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
}

function DesktopHeader({
  isCardFrozen,
  isFreezing,
  isCardFlipped,
  isLoadingCardDetails,
  onCardDetails,
  onFreezeToggle,
}: DesktopHeaderProps) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-5xl font-semibold">Card</Text>
      <View className="flex-row items-center gap-2">
        <Button
          variant="secondary"
          className="h-12 rounded-xl border-0 bg-[#303030] px-6"
          onPress={onCardDetails}
          disabled={isLoadingCardDetails}
        >
          <View className="flex-row items-center gap-2">
            {isLoadingCardDetails ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={getAsset('images/reveal_card_details_icon.png')}
                style={styles.smallIcon}
                contentFit="contain"
              />
            )}
            <Text className="text-base font-bold text-white">
              {isCardFlipped ? 'Hide details' : 'Card details'}
            </Text>
          </View>
        </Button>
        <Button
          variant="secondary"
          className="h-12 rounded-xl border-0 bg-[#303030] px-6"
          onPress={onFreezeToggle}
          disabled={isFreezing}
        >
          <View className="flex-row items-center gap-2">
            {isFreezing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={getAsset('images/freeze_button_icon.png')}
                style={styles.mediumIcon}
                contentFit="contain"
              />
            )}
            <Text className="text-base font-bold text-white">
              {isCardFrozen ? 'Unfreeze' : 'Freeze'}
            </Text>
          </View>
        </Button>
        <DepositToCardModal
          trigger={
            <Button className="h-12 rounded-xl border-0 px-6" style={styles.depositButton}>
              <View className="flex-row items-center gap-2">
                <Plus size={22} color="black" />
                <Text className="text-base font-bold text-black">Deposit</Text>
              </View>
            </Button>
          }
        />
      </View>
    </View>
  );
}

interface SpendingBalanceCardProps {
  amount: string;
  cashback?: {
    monthlyFuseAmount: number;
    monthlyUsdValue: number;
    totalFuseAmount: number;
    totalUsdValue: number;
    percentage: number;
  };
}

function SpendingBalanceCard({ amount, cashback }: SpendingBalanceCardProps) {
  const formattedAmount = Number.parseFloat(amount).toFixed(2);
  const totalUsdValue = cashback?.totalUsdValue ? parseFloat(cashback.totalUsdValue.toFixed(0)) : 0;
  const cashbackPercentage = cashback?.percentage || 0;

  return (
    <View className="relative h-full overflow-hidden rounded-[20px] px-[36px] py-[30px]">
      <LinearGradient
        colors={['rgba(104, 216, 82, 1)', 'rgba(104, 216, 82, 0.4)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        pointerEvents="none"
        style={styles.gradientOverlayWithOpacity}
      />
      <View className="flex-1 justify-between">
        {/* Spending Balance Section */}
        <View>
          <Text className="mb-2 text-base text-white/60">Spending balance</Text>
          <Text className="text-[50px] font-semibold text-white">${formattedAmount}</Text>
        </View>

        {/* Cashback Section */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="mb-1 text-lg font-medium text-white/50">Cashback earned</Text>
            <Text className="text-2xl font-semibold text-[#94F27F]">${totalUsdValue}</Text>
          </View>

          {/* Cashback Badge */}
          <View className="flex-row  items-center gap-1 px-4">
            <Image
              source={getAsset('images/diamond.png')}
              style={styles.diamondIconLarge}
              contentFit="contain"
            />
            <Text className="text-lg font-light text-white" style={styles.lineHeight20}>
              you are receiving{'\n'}
              <Text className="font-bold text-[#94F27F]">
                {Math.round(cashbackPercentage * 100)}%
              </Text>{' '}
              cashback on all{'\n'}purchases
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

interface BalanceDisplayProps {
  amount: string;
}

function BalanceDisplay({ amount }: BalanceDisplayProps) {
  const formattedAmount = Number.parseFloat(amount).toFixed(2);
  return (
    <View className="mt-10 items-center">
      <Text className="text-[50px] font-semibold">${formattedAmount}</Text>
      <Text className="text-base opacity-70">Spendable balance</Text>
    </View>
  );
}

interface CardImageSectionProps {
  isScreenMedium: boolean;
  isCardFrozen: boolean;
  flipAnimation: Animated.Value;
  isCardFlipped: boolean;
  cardholderName?: CardHolderName;
  shouldRevealDetails: boolean;
  onCardDetailsLoaded: () => void;
}

function CardImageSection({
  isScreenMedium,
  isCardFrozen,
  flipAnimation,
  isCardFlipped,
  cardholderName,
  shouldRevealDetails,
  onCardDetailsLoaded,
}: CardImageSectionProps) {
  const desktopImagePath = isCardFrozen
    ? getAsset('images/card_frozen.png')
    : getAsset('images/activate_card_steps.png');

  const desktopImageAspectRatio = isCardFrozen ? 531 / 328 : 513 / 306;

  const frontRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backRotation = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View
      className={cn('items-center', !isScreenMedium && 'mb-6 mt-12')}
      style={{
        paddingHorizontal: isCardFrozen || !isScreenMedium ? 0 : 2,
      }}
    >
      <View style={styles.cardContainer}>
        {/* Front of card */}
        <Animated.View
          style={[
            styles.cardFront,
            { transform: [{ rotateY: frontRotation }], opacity: frontOpacity },
          ]}
        >
          <Image
            source={desktopImagePath}
            alt="Solid Card"
            style={[styles.cardImage, { aspectRatio: desktopImageAspectRatio }]}
            contentFit="contain"
          />
        </Animated.View>

        {/* Back of card with details overlay */}
        <Animated.View
          style={[
            styles.cardBack,
            { transform: [{ rotateY: backRotation }], opacity: backOpacity },
          ]}
        >
          <Image
            source={desktopImagePath}
            alt="Solid Card"
            style={[styles.cardImage, { aspectRatio: desktopImageAspectRatio }]}
            contentFit="contain"
          />
          {shouldRevealDetails && (
            <CardDetailsOverlay
              cardholderName={cardholderName}
              onDetailsLoaded={onCardDetailsLoaded}
              visible={isCardFlipped}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

interface CardDetailsOverlayProps {
  cardholderName?: CardHolderName;
  onDetailsLoaded: () => void;
  visible?: boolean;
}

function CardDetailsOverlay({
  cardholderName,
  onDetailsLoaded,
  visible = false,
}: CardDetailsOverlayProps) {
  const { cardDetails, isLoading, error, revealDetails } = useCardDetailsReveal();
  const hasRevealedRef = useRef(false);
  const hasNotifiedLoadedRef = useRef(false);
  const clipboardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup clipboard timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Only reveal details once when component mounts
    if (!hasRevealedRef.current) {
      hasRevealedRef.current = true;
      revealDetails();
    }
    // Reset ref when component unmounts so it can fetch again if remounted
    return () => {
      hasRevealedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - revealDetails is stable from useCallback, and we only want to run on mount

  // Call onDetailsLoaded when details are successfully loaded
  useEffect(() => {
    if (!hasNotifiedLoadedRef.current && cardDetails && !isLoading && !error) {
      hasNotifiedLoadedRef.current = true;
      onDetailsLoaded();
    }
  }, [cardDetails, isLoading, error, onDetailsLoaded]);

  const formatCardNumber = (cardNumber: string) => {
    return cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiryDate = (expiryDate: string) => {
    const date = new Date(expiryDate);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${year}`;
  };

  const handleCopyCardNumber = useCallback(async () => {
    if (!cardDetails) return;
    try {
      await Clipboard.setStringAsync(formatCardNumber(cardDetails.card_number));
      Toast.show({
        type: 'success',
        text1: 'Card number copied',
        text2: 'Clipboard will clear in 30 seconds',
        props: { badgeText: '' },
        visibilityTime: 4000,
      });
      // Clear any existing timeout before setting a new one
      if (clipboardTimeoutRef.current) {
        clearTimeout(clipboardTimeoutRef.current);
      }
      // Clear clipboard after 30 seconds for security
      clipboardTimeoutRef.current = setTimeout(async () => {
        try {
          // Only clear if clipboard still contains the card number
          const currentClipboard = await Clipboard.getStringAsync();
          if (currentClipboard === formatCardNumber(cardDetails.card_number)) {
            await Clipboard.setStringAsync('');
          }
        } catch {
          // Silently fail if clipboard clearing fails
        }
      }, 30000);
    } catch (_error) {
      Alert.alert('Error', 'Failed to copy card number');
    }
  }, [cardDetails]);

  // Don't render if still loading, error, or no data
  if (isLoading || error || !cardDetails) {
    return null;
  }

  // At this point cardDetails is guaranteed to be non-null
  const safeCardDetails = cardDetails;

  const displayName = cardholderName
    ? `${cardholderName.first_name} ${cardholderName.last_name}`
    : 'Cardholder';

  // Keep rendered but hide with opacity when not visible
  if (!visible) {
    return (
      <View
        style={styles.cardDetailsHidden}
        className="absolute inset-0 mt-24 justify-center rounded-2xl p-6"
      >
        <View className="mb-5">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl font-medium" style={styles.cardDetailsText}>
              {formatCardNumber(safeCardDetails.card_number)}
            </Text>
            <Pressable
              onPress={handleCopyCardNumber}
              className="p-2 web:hover:opacity-70"
              accessibilityLabel="Copy card number to clipboard"
              accessibilityRole="button"
            >
              <Copy size={20} color="#2E6A25" />
            </Pressable>
          </View>
        </View>

        <View className="flex-row">
          <View className="mr-6 flex-1">
            <View className="mt-4 flex-row items-end">
              <Text className="mb-1 text-[9px] font-extrabold" style={styles.cardDetailsText}>
                {'GOOD\nTHRU'}
              </Text>
              <Text className="ml-2 text-lg font-semibold" style={styles.cardDetailsText}>
                {formatExpiryDate(cardDetails.expiry_date)}
              </Text>
            </View>
            <Text
              className="mt-6 text-sm font-semibold md:text-lg"
              style={styles.cardDetailsText}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>
          <View className="mt-4 flex-1">
            <Text className="text-xs font-semibold" style={styles.cardDetailsText}>
              CVV
            </Text>
            <Text className="text-lg font-semibold" style={styles.cardDetailsText}>
              {cardDetails.card_security_code}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 mt-12 justify-center rounded-2xl p-6 md:mt-24">
      <View className="mb-5">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg font-medium md:text-3xl" style={styles.cardDetailsText}>
            {formatCardNumber(cardDetails.card_number)}
          </Text>
          <Pressable
            onPress={handleCopyCardNumber}
            className="p-2 web:hover:opacity-70"
            accessibilityLabel="Copy card number to clipboard"
            accessibilityRole="button"
          >
            <Copy size={20} color="#2E6A25" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row">
        <View className="mr-6 flex-1">
          <View className="flex-row items-end md:mt-4">
            <Text className="mb-1 text-[9px] font-extrabold" style={styles.cardDetailsText}>
              {'GOOD\nTHRU'}
            </Text>
            <Text className="ml-2 text-lg font-semibold" style={styles.cardDetailsText}>
              {formatExpiryDate(cardDetails.expiry_date)}
            </Text>
          </View>
          <Text
            className="mt-6 text-sm font-semibold md:text-lg"
            style={styles.cardDetailsText}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>
        <View className="flex-1 md:mt-4">
          <Text className="text-xs font-semibold" style={styles.cardDetailsText}>
            CVV
          </Text>
          <Text className="font-semibold md:text-lg" style={styles.cardDetailsText}>
            {cardDetails.card_security_code}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface CardActionsProps {
  isCardFrozen: boolean;
  isFreezing: boolean;
  isCardFlipped: boolean;
  isLoadingCardDetails: boolean;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
}

function CardActions({
  isCardFrozen,
  isFreezing,
  isCardFlipped,
  isLoadingCardDetails,
  onCardDetails,
  onFreezeToggle,
}: CardActionsProps) {
  return (
    <View className="native:gap-8 mb-8 flex-row items-center justify-center web:space-x-8">
      <DepositToCardModal
        trigger={
          <CircularActionButton
            icon={getAsset('images/card_actions_fund.png')}
            label="Add funds"
            onPress={() => {}}
          />
        }
      />
      <CircularActionButton
        icon={getAsset('images/card_actions_details.png')}
        label={isCardFlipped ? 'Hide details' : 'Card details'}
        onPress={onCardDetails}
        isLoading={isLoadingCardDetails}
      />
      <CircularActionButton
        icon={getAsset('images/card_actions_freeze.png')}
        label={isCardFrozen ? 'Unfreeze' : 'Freeze'}
        onPress={onFreezeToggle}
        isLoading={isFreezing}
      />
    </View>
  );
}

function DepositBonusBanner() {
  const { isScreenMedium } = useDimension();

  if (isScreenMedium) {
    return (
      <View className="relative h-full overflow-hidden rounded-2xl border border-[#FFD15126]">
        <LinearGradient
          colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
          style={styles.gradientOverlay}
        />
        <View className="flex-row items-center gap-4 p-4 md:p-5">
          <Link
            href={
              'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
            }
            target="_blank"
            className="rounded-full bg-[#FFD151]/20 px-3 py-1"
          >
            <Text className="text-sm font-bold text-[#FFD151]">
              Receive your $50 sign up bonus!
            </Text>
          </Link>
          <View className="flex-1 flex-row items-center justify-between">
            <Text className="text-sm font-medium text-[#FFD151]">On a minimum deposit of $100</Text>
            <View className="flex-row items-center gap-1">
              <Link
                target="_blank"
                href={
                  'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
                }
                className="font-bold text-[#FFD151]"
              >
                Learn more
              </Link>
              <View className="pt-0.5">
                <ChevronRight size={16} color="#FFD151" />
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="relative mb-4 overflow-hidden rounded-3xl border border-[#FFD15126]">
      <LinearGradient
        colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
        style={styles.gradientOverlay}
      />
      <View className="flex-col items-center gap-3 p-4">
        <Link
          href={
            'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
          }
          target="_blank"
          className="rounded-full bg-[#FFD151]/20 px-4 py-1.5"
        >
          <Text className="text-lg font-bold text-[#FFD151]">Receive your $50 sign up bonus!</Text>
        </Link>
        <Text className="text-center text-lg font-medium text-[#FFD151]">
          On a minimum deposit of $100
        </Text>
      </View>
    </View>
  );
}

interface CashbackDisplayProps {
  cashback?: {
    monthlyFuseAmount: number;
    monthlyUsdValue: number;
    totalFuseAmount: number;
    totalUsdValue: number;
    percentage: number;
  };
}

function CashbackDisplay({ cashback }: CashbackDisplayProps) {
  const totalUsdValue = cashback?.totalUsdValue ? parseFloat(cashback.totalUsdValue.toFixed(2)) : 0;

  const cashbackPercentage = cashback?.percentage || 0;

  return (
    <View className="relative mb-4 overflow-hidden rounded-[20px] py-[10px]">
      <LinearGradient
        colors={['rgba(104, 216, 82, 1)', 'rgba(104, 216, 82, 0.4)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        pointerEvents="none"
        style={styles.gradientOverlayWithOpacity}
      />
      {/* Top Section */}
      <View className="mb-2 flex-row items-start justify-between px-4">
        <View>
          <Text className="mb-1 text-lg text-white/70">Cashback earned</Text>
          <Text className="text-2xl font-semibold text-[#94F27F]">${totalUsdValue}</Text>
        </View>
        <Image
          source={getAsset('images/diamond.png')}
          style={styles.diamondIconSmall}
          contentFit="contain"
        />
      </View>

      {/* Divider */}
      <View style={styles.cashbackDivider} />

      {/* Bottom Text */}
      <View>
        <Text className="pb-2 pl-4 text-lg font-light text-white" style={styles.lineHeight20}>
          you are receiving{' '}
          <Text className="font-bold text-[#94F27F]">{Math.round(cashbackPercentage * 100)}%</Text>{' '}
          cashback on
          {'\n'}
          all purchases
        </Text>
      </View>
    </View>
  );
}

interface AddToWalletButtonProps {
  onPress: () => void;
}

function AddToWalletButton({ onPress }: AddToWalletButtonProps) {
  const { isScreenMedium } = useDimension();

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-between rounded-2xl bg-[#1E1E1E] p-4 web:hover:bg-[#2a2a2a] md:h-full"
    >
      <View className="flex-1 flex-row items-center">
        <Text className="mr-2 text-base font-bold text-white">
          {isScreenMedium ? 'Add to' : 'Add to wallet'}
        </Text>
        <View className="flex-row items-center">
          <Image
            source={getAsset('images/apple_pay.png')}
            style={styles.applePayIcon}
            contentFit="contain"
          />
          <View className="mx-2 h-6 w-px bg-white/30" />
          <Image
            source={getAsset('images/google_pay.png')}
            style={styles.googlePayIcon}
            contentFit="contain"
          />
        </View>
      </View>
      <ChevronRight color="white" size={22} />
    </Pressable>
  );
}

interface RecentTransactionsProps {
  transactions: CardTransaction[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage?: boolean;
  onLoadMore: () => void;
}

function RecentTransactions({
  transactions,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
}: RecentTransactionsProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce(
    (groups, transaction) => {
      const dateKey = formatDate(transaction.posted_at);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
      return groups;
    },
    {} as Record<string, CardTransaction[]>,
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderTransaction = (item: CardTransaction, isLast: boolean) => {
    const isPurchase = item.category === 'purchase';
    const merchantName = item.merchant_name || item.description;
    const color = getColorForTransaction(merchantName);

    const transactionUrl = item.crypto_transaction_details?.tx_hash
      ? `https://etherscan.io/tx/${item.crypto_transaction_details.tx_hash}`
      : undefined;

    return (
      <Pressable
        key={item.id}
        onPress={() =>
          router.push({
            pathname: '/activity/[clientTxId]',
            params: { clientTxId: `card-${item.id}`, from: 'card' },
          })
        }
        className={cn(
          'flex-row items-center justify-between p-4 md:px-6',
          'border-b border-border/40',
          {
            'border-b-0': isLast,
          },
        )}
      >
        <View className="mr-2 flex-1 flex-row items-center gap-2 md:gap-4">
          {isPurchase ? (
            <View
              className="items-center justify-center overflow-hidden rounded-full"
              style={[styles.transactionAvatar, { backgroundColor: color.bg }]}
            >
              <Text className="text-lg font-semibold" style={{ color: color.text }}>
                {getInitials(merchantName)}
              </Text>
            </View>
          ) : (
            <RenderTokenIcon
              tokenIcon={getTokenIcon({
                tokenSymbol: item.currency?.toUpperCase(),
                size: 43,
              })}
              size={43}
            />
          )}
          <View className="flex-1">
            <Text className="text-lg font-medium" numberOfLines={1}>
              {merchantName}
            </Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {formatDate(item.posted_at)}
              {', '}
              {formatTime(item.posted_at)}
            </Text>
          </View>
        </View>
        <View className="flex-shrink-0 flex-row items-center gap-2 md:gap-10">
          <Text className={`text-right font-bold text-white`}>
            {formatCardAmountWithCurrency(item.amount, item.currency)}
          </Text>
          {Platform.OS === 'web' ? (
            <TransactionDropdown url={transactionUrl} />
          ) : (
            <TransactionDrawer url={transactionUrl} />
          )}
        </View>
      </Pressable>
    );
  };

  if (isLoading) {
    return (
      <View className="mb-28">
        <Text className="mb-4 mt-4 text-lg font-semibold text-[#A1A1A1]">Recent transactions</Text>
        <View className="py-8">
          <Loading />
        </View>
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View className="mb-28">
        <Text className="mb-4 mt-4 text-lg font-semibold text-[#A1A1A1]">Recent transactions</Text>
        <View className="rounded-2xl bg-[#1C1C1C] p-8">
          <Text className="text-center text-[#ACACAC]">No transactions yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-28 mt-24">
      <Text className="mb-4 text-lg font-semibold text-[#A1A1A1]">Recent transactions</Text>
      {Object.entries(groupedTransactions).map(([date, txs], groupIndex) => (
        <View key={groupIndex} className="mb-4 mt-5">
          <Text className="mb-2 text-base font-semibold text-white/60">{date}</Text>
          <View className="overflow-hidden rounded-2xl bg-[#1C1C1C]">
            {txs.map((tx, index) => renderTransaction(tx, index === txs.length - 1))}
          </View>
        </View>
      ))}
      {isFetchingNextPage && (
        <View className="py-4">
          <Loading />
        </View>
      )}
      {hasNextPage && !isFetchingNextPage && (
        <Pressable onPress={onLoadMore} className="items-center rounded-2xl bg-[#1E1E1E] p-4">
          <Text className="font-bold text-white">Load more</Text>
        </Pressable>
      )}
    </View>
  );
}

// Extracted styles for better performance - avoids creating new objects on each render
const styles = StyleSheet.create({
  // Icon sizes
  smallIcon: { width: 15, height: 15 },
  mediumIcon: { width: 18, height: 18 },
  diamondIconLarge: { width: 82, aspectRatio: 72 / 66 },
  diamondIconSmall: { width: 80, aspectRatio: 56 / 51 },
  applePayIcon: { width: 49, height: 22 },
  googlePayIcon: { width: 47, height: 19 },
  transactionAvatar: { width: 43, height: 43 },

  // Button backgrounds
  depositButton: { backgroundColor: '#94F27F' },

  // Gradient overlays (used with LinearGradient)
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
  },
  gradientOverlayWithOpacity: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
    opacity: 0.25,
  },

  // Card flip animation
  cardContainer: { position: 'relative', width: '100%' },
  cardFront: { backfaceVisibility: 'hidden' },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backfaceVisibility: 'hidden',
  },
  cardImage: { width: '100%' },

  // Card details overlay
  cardDetailsHidden: { opacity: 0, pointerEvents: 'none' },
  cardDetailsText: { color: '#2E6A25' },

  // Cashback display
  cashbackDivider: {
    height: 1,
    backgroundColor: '#3D5A3B',
    width: '100%',
    marginBottom: 16,
  },

  // Text styles
  lineHeight20: { lineHeight: 20 },
});
