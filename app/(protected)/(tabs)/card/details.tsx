import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Copy, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Platform,
  Pressable,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';

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
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import { useCardTransactions } from '@/hooks/useCardTransactions';
import { useDimension } from '@/hooks/useDimension';
import { freezeCard, unfreezeCard } from '@/lib/api';
import getTokenIcon from '@/lib/getTokenIcon';
import { CardHolderName, CardStatus, CardTransaction } from '@/lib/types';
import {
  formatCardAmountWithCurrency,
  getColorForTransaction,
  getInitials,
} from '@/lib/utils/cardHelpers';
import { cn } from '@/lib/utils/utils';

interface CardHeaderProps {
  onBackPress: () => void;
}

export default function CardDetails() {
  const { data: cardDetails, isLoading, refetch } = useCardDetails();
  const { isScreenMedium } = useDimension();
  const [isFreezing, setIsFreezing] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [shouldRevealDetails, setShouldRevealDetails] = useState(false);
  const [isAddToWalletModalOpen, setIsAddToWalletModalOpen] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const router = useRouter();

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

  const handleBackPress = () => {
    router.push(path.HOME);
  };

  const handleFreezeToggle = async () => {
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
  };

  const handleCardFlip = () => {
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
  };

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
        <View className="w-full max-w-7xl mx-auto px-4 pt-8 pb-12">
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
          <View className="flex-row gap-6 mt-12">
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
          <View className="flex-row gap-6 mt-4">
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
    <PageLayout desktopOnly isLoading={isLoading}>
      <View className="w-full max-w-lg mx-auto px-4 pt-8">
        <MobileHeader onBackPress={handleBackPress} />

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

function MobileHeader({ onBackPress }: CardHeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <Pressable onPress={onBackPress} className="web:hover:opacity-70">
        <ArrowLeft color="white" />
      </Pressable>
      <Text className="text-white text-xl md:text-2xl font-semibold text-center">Solid card</Text>
      <View className="w-4" />
    </View>
  );
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
    <View className="flex-row items-center justify-between">
      <Text className="text-3xl font-semibold">Card</Text>
      <View className="flex-row items-center gap-2">
        <Button
          variant="secondary"
          className="h-12 px-6 rounded-xl bg-[#303030] border-0"
          onPress={onCardDetails}
          disabled={isLoadingCardDetails}
        >
          <View className="flex-row items-center gap-2">
            {isLoadingCardDetails ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={require('@/assets/images/reveal_card_details_icon.png')}
                style={{ width: 15, height: 15 }}
                contentFit="contain"
              />
            )}
            <Text className="text-base text-white font-bold">
              {isCardFlipped ? 'Hide details' : 'Card details'}
            </Text>
          </View>
        </Button>
        <Button
          variant="secondary"
          className="h-12 px-6 rounded-xl bg-[#303030] border-0"
          onPress={onFreezeToggle}
          disabled={isFreezing}
        >
          <View className="flex-row items-center gap-2">
            {isFreezing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Image
                source={require('@/assets/images/freeze_button_icon.png')}
                style={{ width: 18, height: 18 }}
                contentFit="contain"
              />
            )}
            <Text className="text-base text-white font-bold">
              {isCardFrozen ? 'Unfreeze' : 'Freeze'}
            </Text>
          </View>
        </Button>
        <DepositToCardModal
          trigger={
            <Button
              className="h-12 px-6 rounded-xl border-0"
              style={{ backgroundColor: '#94F27F' }}
            >
              <View className="flex-row items-center gap-2">
                <Plus size={22} color="black" />
                <Text className="text-base text-black font-bold">Deposit</Text>
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
    <LinearGradient
      colors={['rgba(104, 216, 82, 0.25)', 'rgba(104, 216, 82, 0.1)']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="rounded-[20px] py-[30px] px-[36px] h-full"
    >
      <View className="flex-1 justify-between">
        {/* Spending Balance Section */}
        <View>
          <Text className="text-white/60 text-base mb-2">Spending balance</Text>
          <Text className="text-white text-[50px] font-semibold">${formattedAmount}</Text>
        </View>

        {/* Cashback Section */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-white/50 text-lg mb-1 font-medium">Cashback earned</Text>
            <Text className="text-[#94F27F] text-2xl font-semibold">${totalUsdValue}</Text>
          </View>

          {/* Cashback Badge */}
          <View className="px-4  flex-row items-center gap-1">
            <Image
              source={require('@/assets/images/diamond.png')}
              style={{ width: 82, aspectRatio: 72 / 66 }}
              contentFit="contain"
            />
            <Text className="text-white text-lg font-light" style={{ lineHeight: 20 }}>
              you are receiving{'\n'}
              <Text className="text-[#94F27F] font-bold">
                {Math.round(cashbackPercentage * 100)}%
              </Text>{' '}
              cashback on all{'\n'}purchases
            </Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

interface BalanceDisplayProps {
  amount: string;
}

function BalanceDisplay({ amount }: BalanceDisplayProps) {
  const formattedAmount = Number.parseFloat(amount).toFixed(2);
  return (
    <View className="items-center mt-10">
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
    ? require('@/assets/images/card_frozen.png')
    : require('@/assets/images/activate_card_steps.png');

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
      className={cn('items-center', !isScreenMedium && 'mt-12 mb-6')}
      style={{
        paddingHorizontal: isCardFrozen || !isScreenMedium ? 0 : 2,
      }}
    >
      <View style={{ position: 'relative', width: '100%' }}>
        {/* Front of card */}
        <Animated.View
          style={{
            backfaceVisibility: 'hidden',
            transform: [{ rotateY: frontRotation }],
            opacity: frontOpacity,
          }}
        >
          <Image
            source={desktopImagePath}
            alt="Solid Card"
            style={{
              width: '100%',
              aspectRatio: desktopImageAspectRatio,
            }}
            contentFit="contain"
          />
        </Animated.View>

        {/* Back of card with details overlay */}
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            backfaceVisibility: 'hidden',
            transform: [{ rotateY: backRotation }],
            opacity: backOpacity,
          }}
        >
          <Image
            source={desktopImagePath}
            alt="Solid Card"
            style={{
              width: '100%',
              aspectRatio: desktopImageAspectRatio,
            }}
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
      await Clipboard.setString(formatCardNumber(cardDetails.card_number));
      Toast.show({
        type: 'success',
        text1: 'Card number copied',
        props: { badgeText: '' },
        visibilityTime: 4000,
      });
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
        style={{ opacity: 0, pointerEvents: 'none' }}
        className="absolute inset-0 rounded-2xl p-6 mt-24 justify-center"
      >
        <View className="mb-5">
          <View className="flex-row items-center gap-2">
            <Text className="text-3xl font-medium" style={{ color: '#2E6A25' }}>
              {formatCardNumber(safeCardDetails.card_number)}
            </Text>
            <Pressable onPress={handleCopyCardNumber} className="p-2 web:hover:opacity-70">
              <Copy size={20} color="#2E6A25" />
            </Pressable>
          </View>
        </View>

        <View className="flex-row">
          <View className="flex-1 mr-6">
            <View className="flex-row items-end mt-4">
              <Text className="text-[9px] font-extrabold mb-1" style={{ color: '#2E6A25' }}>
                {'GOOD\nTHRU'}
              </Text>
              <Text className="text-lg ml-2 font-semibold" style={{ color: '#2E6A25' }}>
                {formatExpiryDate(cardDetails.expiry_date)}
              </Text>
            </View>
            <Text
              className="text-sm md:text-lg font-semibold mt-6"
              style={{ color: '#2E6A25' }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>
          <View className="flex-1 mt-4">
            <Text className="text-xs font-semibold" style={{ color: '#2E6A25' }}>
              CVV
            </Text>
            <Text className="text-lg font-semibold" style={{ color: '#2E6A25' }}>
              {cardDetails.card_security_code}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="absolute inset-0 rounded-2xl p-6 mt-12 md:mt-24 justify-center">
      <View className="mb-5">
        <View className="flex-row items-center gap-2">
          <Text className="text-lg md:text-3xl font-medium" style={{ color: '#2E6A25' }}>
            {formatCardNumber(cardDetails.card_number)}
          </Text>
          <Pressable onPress={handleCopyCardNumber} className="p-2 web:hover:opacity-70">
            <Copy size={20} color="#2E6A25" />
          </Pressable>
        </View>
      </View>

      <View className="flex-row">
        <View className="flex-1 mr-6">
          <View className="flex-row items-end md:mt-4">
            <Text className="text-[9px] font-extrabold mb-1" style={{ color: '#2E6A25' }}>
              {'GOOD\nTHRU'}
            </Text>
            <Text className="text-lg ml-2 font-semibold" style={{ color: '#2E6A25' }}>
              {formatExpiryDate(cardDetails.expiry_date)}
            </Text>
          </View>
          <Text
            className="text-sm md:text-lg font-semibold mt-6"
            style={{ color: '#2E6A25' }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>
        <View className="flex-1 md:mt-4">
          <Text className="text-xs font-semibold" style={{ color: '#2E6A25' }}>
            CVV
          </Text>
          <Text className="md:text-lg font-semibold" style={{ color: '#2E6A25' }}>
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
    <View className="flex-row justify-center web:space-x-8 native:gap-8 items-center mb-8">
      <DepositToCardModal
        trigger={
          <CircularActionButton
            icon={require('@/assets/images/card_actions_fund.png')}
            label="Add funds"
            onPress={() => {}}
          />
        }
      />
      <CircularActionButton
        icon={require('@/assets/images/card_actions_details.png')}
        label={isCardFlipped ? 'Hide details' : 'Card details'}
        onPress={onCardDetails}
        isLoading={isLoadingCardDetails}
      />
      <CircularActionButton
        icon={require('@/assets/images/card_actions_freeze.png')}
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
      <LinearGradient
        colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        locations={[0.0964, 0.6892]}
        className="rounded-2xl p-4 md:p-5 flex-row items-center gap-4 h-full border border-[#FFD15126]"
      >
        <Link
          href={
            'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
          }
          target="_blank"
          className="bg-[#FFD151]/20 rounded-full px-3 py-1"
        >
          <Text className="text-[#FFD151] font-bold text-sm">Receive your $50 sign up bonus!</Text>
        </Link>
        <View className="flex-1 flex-row items-center justify-between">
          <Text className="text-[#FFD151] text-sm font-medium">On a minimum deposit of $100</Text>
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
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['rgba(255, 209, 81, 0.1)', 'rgba(255, 209, 81, 0.05)']}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      locations={[0.0964, 0.6892]}
      className="rounded-3xl p-4 flex-col items-center gap-3 mb-4 border border-[#FFD15126]"
    >
      <Link
        href={
          'https://support.solid.xyz/en/articles/13213137-solid-card-launch-campaign-terms-conditions'
        }
        target="_blank"
        className="bg-[#FFD151]/20 rounded-full px-4 py-1.5"
      >
        <Text className="text-[#FFD151] font-bold text-lg">Receive your $50 sign up bonus!</Text>
      </Link>
      <Text className="text-[#FFD151] text-lg font-medium text-center">
        On a minimum deposit of $100
      </Text>
    </LinearGradient>
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
    <LinearGradient
      colors={['rgba(104, 216, 82, 0.25)', 'rgba(104, 216, 82, 0.1)']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="rounded-[20px] mb-4 py-[10px]"
    >
      {/* Top Section */}
      <View className="flex-row justify-between items-start mb-2 px-4">
        <View>
          <Text className="text-white/70 text-lg mb-1">Cashback earned</Text>
          <Text className="text-[#94F27F] text-2xl font-semibold">${totalUsdValue}</Text>
        </View>
        <Image
          source={require('@/assets/images/diamond.png')}
          style={{ width: 80, aspectRatio: 56 / 51 }}
          contentFit="contain"
        />
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: '#3D5A3B', width: '100%', marginBottom: 16 }} />

      {/* Bottom Text */}
      <View>
        <Text className="text-white text-lg pl-4 pb-2 font-light" style={{ lineHeight: 20 }}>
          you are receiving{' '}
          <Text className="text-[#94F27F] font-bold">{Math.round(cashbackPercentage * 100)}%</Text>{' '}
          cashback on
          {'\n'}
          all purchases
        </Text>
      </View>
    </LinearGradient>
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
      className="bg-[#1E1E1E] rounded-2xl flex-row items-center justify-between p-4 md:h-full web:hover:bg-[#2a2a2a]"
    >
      <View className="flex-row items-center flex-1">
        <Text className="text-base font-bold text-white mr-2">
          {isScreenMedium ? 'Add to' : 'Add to wallet'}
        </Text>
        <View className="flex-row items-center">
          <Image
            source={require('@/assets/images/apple_pay.png')}
            style={{ width: 49, height: 22 }}
            contentFit="contain"
          />
          <View className="w-px h-6 bg-white/30 mx-2" />
          <Image
            source={require('@/assets/images/google_pay.png')}
            style={{ width: 47, height: 19 }}
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
        <View className="flex-row items-center gap-2 md:gap-4 flex-1 mr-2">
          {isPurchase ? (
            <View
              className="rounded-full overflow-hidden items-center justify-center"
              style={{ width: 43, height: 43, backgroundColor: color.bg }}
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
        <View className="flex-row items-center gap-2 md:gap-10 flex-shrink-0">
          <Text className={`font-bold text-right text-white`}>
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
        <Text className="text-lg font-semibold text-[#A1A1A1] mb-4 mt-4">Recent transactions</Text>
        <View className="py-8">
          <Loading />
        </View>
      </View>
    );
  }

  if (transactions.length === 0) {
    return (
      <View className="mb-28">
        <Text className="text-lg font-semibold text-[#A1A1A1] mb-4 mt-4">Recent transactions</Text>
        <View className="bg-[#1C1C1C] rounded-2xl p-8">
          <Text className="text-center text-[#ACACAC]">No transactions yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-28 mt-24">
      <Text className="text-lg font-semibold text-[#A1A1A1] mb-4">Recent transactions</Text>
      {Object.entries(groupedTransactions).map(([date, txs], groupIndex) => (
        <View key={groupIndex} className="mb-4 mt-5">
          <Text className="text-base font-semibold text-white/60 mb-2">{date}</Text>
          <View className="bg-[#1C1C1C] rounded-2xl overflow-hidden">
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
        <Pressable onPress={onLoadMore} className="bg-[#1E1E1E] rounded-2xl p-4 items-center">
          <Text className="text-white font-bold">Load more</Text>
        </Pressable>
      )}
    </View>
  );
}
