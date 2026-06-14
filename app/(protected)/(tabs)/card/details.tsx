import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Copy, KeyRound, Plus, Settings } from 'lucide-react-native';

import AddToWalletModal from '@/components/Card/AddToWalletModal';
import { BorrowPositionCard } from '@/components/Card/BorrowPositionCard';
import CardWelcomePopup from '@/components/Card/CardWelcomePopup';
import { CircularActionButton } from '@/components/Card/CircularActionButton';
import DepositToCardModal from '@/components/Card/DepositToCardModal';
import ManagePinModal from '@/components/Card/ManagePinModal';
import WithdrawToCardModal from '@/components/Card/WithdrawToCardModal';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import { useCardProvider } from '@/hooks/useCardProvider';
import { useCardWithdrawals } from '@/hooks/useCardWithdrawals';
import { useCustomer } from '@/hooks/useCustomer';
import { useDimension } from '@/hooks/useDimension';
import { freezeCard, unfreezeCard } from '@/lib/api';
import { getAsset } from '@/lib/assets';
import { isProduction } from '@/lib/config';
import { CardHolderName, CardProvider, CardStatus, FreezeInitiator, KycStatus } from '@/lib/types';
import { cn } from '@/lib/utils/utils';
import { useCardWelcomePopupStore } from '@/store/useCardWelcomePopupStore';

export default function CardDetails() {
  const { data: cardDetails, isLoading, refetch } = useCardDetails();
  const { provider } = useCardProvider();
  const { data: customer } = useCustomer();
  const { isScreenMedium } = useDimension();

  useCardWithdrawals({ limit: 10 }, { refetchInterval: 300000 });

  const [isFreezing, setIsFreezing] = useState(false);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [shouldRevealDetails, setShouldRevealDetails] = useState(false);
  const [isAddToWalletModalOpen, setIsAddToWalletModalOpen] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;

  const { state: debugState } = useLocalSearchParams<{ state?: string }>();
  const isDebugWelcome = !isProduction && debugState === 'welcome';

  const storeShouldShowWelcomePopup = useCardWelcomePopupStore(
    state => state.shouldShowWelcomePopup,
  );
  const setShouldShowWelcomePopup = useCardWelcomePopupStore(
    state => state.setShouldShowWelcomePopup,
  );
  const shouldShowWelcomePopup = isDebugWelcome || storeShouldShowWelcomePopup;
  const handleCloseWelcomePopup = useCallback(
    () => setShouldShowWelcomePopup(false),
    [setShouldShowWelcomePopup],
  );

  const availableBalance = cardDetails?.balances.available;
  const availableAmount = Number(availableBalance?.amount || '0').toString();
  const isCardFrozen = cardDetails?.status === CardStatus.FROZEN;

  const canUnfreeze =
    isCardFrozen && cardDetails?.freezes?.some(f => f.initiator === FreezeInitiator.CUSTOMER);

  const isCustomerPausedOrOffboarded =
    customer?.status === KycStatus.PAUSED || customer?.status === KycStatus.OFFBOARDED;

  const isWithdrawFromCardAllowed = !isCardFrozen && !isCustomerPausedOrOffboarded;

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

  const pageHeader = isScreenMedium ? (
    <View className="mx-auto w-full max-w-7xl px-4 pt-12">
      <DesktopHeader
        isCardFrozen={isCardFrozen}
        canUnfreeze={!!canUnfreeze}
        isFreezing={isFreezing}
        isCardFlipped={isCardFlipped}
        isLoadingCardDetails={isLoadingCardDetails}
        onCardDetails={handleCardFlip}
        onFreezeToggle={handleFreezeToggle}
        isWithdrawFromCardAllowed={isWithdrawFromCardAllowed}
        isRain={provider === CardProvider.RAIN}
      />
    </View>
  ) : (
    <View className="mx-auto w-full max-w-lg px-4 pb-[10px] pt-6">
      <MobileHeader />
    </View>
  );

  // Desktop layout
  if (isScreenMedium) {
    return (
      <PageLayout desktopOnly isLoading={isLoading}>
        {pageHeader}
        <View className="mx-auto w-full max-w-7xl px-4 pb-12">
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
                provider={provider}
              />
            </View>
          </View>

          {/* Row 2: View Card Transactions + Add to Wallet */}
          <View className="mt-6 flex-row gap-6">
            <View className="flex-[3]">
              <ViewCardTransactionsButton />
            </View>
            <View className="flex-[2]">
              <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
            </View>
          </View>

          {/* Row 3: Borrow Position Card */}
          <View className="mt-6">
            <BorrowPositionCard variant="desktop" className="min-h-[180px]" />
          </View>
        </View>

        <AddToWalletModal
          isOpen={isAddToWalletModalOpen}
          onOpenChange={setIsAddToWalletModalOpen}
          trigger={null}
        />

        <CardWelcomePopup isOpen={shouldShowWelcomePopup} onClose={handleCloseWelcomePopup} />
      </PageLayout>
    );
  }

  // Mobile layout
  return (
    <PageLayout isLoading={isLoading}>
      {pageHeader}
      <View className="mx-auto w-full max-w-lg px-4">
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
            provider={provider}
          />
          <CardActions
            isCardFrozen={isCardFrozen}
            canUnfreeze={!!canUnfreeze}
            isFreezing={isFreezing}
            isCardFlipped={isCardFlipped}
            isLoadingCardDetails={isLoadingCardDetails}
            onCardDetails={handleCardFlip}
            onFreezeToggle={handleFreezeToggle}
            isWithdrawFromCardAllowed={isWithdrawFromCardAllowed}
            isRain={provider === CardProvider.RAIN}
          />
          <BorrowPositionCard className="mb-4" />
          <CashbackDisplay cashback={cardDetails?.cashback} />
          <ViewCardTransactionsButton />
          <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
          <View className="h-32"></View>
        </View>
      </View>

      <AddToWalletModal
        isOpen={isAddToWalletModalOpen}
        onOpenChange={setIsAddToWalletModalOpen}
        trigger={null}
      />

      <CardWelcomePopup isOpen={shouldShowWelcomePopup} onClose={handleCloseWelcomePopup} />
    </PageLayout>
  );
}

function MobileHeader() {
  return <Text className="text-3xl font-semibold">Card</Text>;
}

interface DesktopHeaderProps {
  isCardFrozen: boolean;
  canUnfreeze: boolean;
  isFreezing: boolean;
  isCardFlipped: boolean;
  isLoadingCardDetails: boolean;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
  isWithdrawFromCardAllowed: boolean;
  isRain: boolean;
}

function DesktopHeader({
  isCardFrozen,
  canUnfreeze,
  isFreezing,
  isCardFlipped,
  isLoadingCardDetails,
  onCardDetails,
  onFreezeToggle,
  isWithdrawFromCardAllowed,
  isRain,
}: DesktopHeaderProps) {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  const showManageDropdown = isRain || !isCardFrozen || canUnfreeze;

  return (
    <View className="flex-row justify-between">
      <Text className="text-3xl font-semibold">Card</Text>
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
        {showManageDropdown && (
          <DropdownMenu onOpenChange={setIsManageOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="h-12 rounded-xl border-0 bg-[#303030] px-6">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-white">Manage</Text>
                  <View style={{ transform: [{ rotate: isManageOpen ? '180deg' : '0deg' }] }}>
                    <ChevronDown size={18} color="white" />
                  </View>
                </View>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              insets={contentInsets}
              className="min-w-[180px] rounded-xl border-0 bg-[#303030] p-0 py-2"
            >
              {isRain && (
                <ManagePinModal
                  trigger={
                    <DropdownMenuItem className="flex-row items-center gap-3 rounded-none px-5 py-3 web:cursor-pointer web:hover:bg-[#404040]">
                      <KeyRound size={18} color="white" />
                      <Text className="text-base font-bold text-white">PIN</Text>
                    </DropdownMenuItem>
                  }
                />
              )}
              {(!isCardFrozen || canUnfreeze) && (
                <DropdownMenuItem
                  className="flex-row items-center gap-3 rounded-none px-5 py-3 web:cursor-pointer web:hover:bg-[#404040]"
                  onPress={onFreezeToggle}
                  disabled={isFreezing}
                >
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
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {isWithdrawFromCardAllowed && (
          <WithdrawToCardModal
            trigger={
              <Button variant="secondary" className="h-12 rounded-xl border-0 bg-[#303030] px-6">
                <View className="flex-row items-center gap-2">
                  <Image
                    source={getAsset('images/card-withdraw.png')}
                    style={styles.smallIcon}
                    contentFit="contain"
                  />
                  <Text className="text-base font-bold text-white">Withdraw</Text>
                </View>
              </Button>
            }
          />
        )}
        {isWithdrawFromCardAllowed && (
          <DepositToCardModal
            trigger={
              <Button className="h-12 rounded-xl border-0 bg-[#94F27F] px-6">
                <View className="flex-row items-center gap-2">
                  <Plus size={22} color="black" />
                  <Text className="text-base font-bold text-black">Deposit</Text>
                </View>
              </Button>
            }
          />
        )}
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
  const totalUsdValue = cashback?.totalUsdValue ? cashback.totalUsdValue.toFixed(2) : '0.00';
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
    <View className="mt-5 items-center">
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
  provider?: CardProvider | null;
}

function CardImageSection({
  isScreenMedium,
  isCardFrozen,
  flipAnimation,
  isCardFlipped,
  cardholderName,
  shouldRevealDetails,
  onCardDetailsLoaded,
  provider,
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
      className={cn('items-center', !isScreenMedium && 'mb-6 mt-[28px]')}
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
              provider={provider}
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
  provider?: CardProvider | null;
}

function CardDetailsOverlay({
  cardholderName,
  onDetailsLoaded,
  visible = false,
  provider,
}: CardDetailsOverlayProps) {
  const { cardDetails, isLoading, error, revealDetails } = useCardDetailsReveal(provider);
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
    // Rain returns MM/YY directly; Bridge returns YYYY-MM-DD
    if (/^\d{2}\/\d{2}$/.test(expiryDate)) return expiryDate;
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
            <Text className="text-3xl font-medium text-[#22591A]">
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
              <Text className="mb-1 text-[9px] font-extrabold text-[#22591A]">{'GOOD\nTHRU'}</Text>
              <Text className="ml-2 text-lg font-semibold text-[#22591A]">
                {formatExpiryDate(cardDetails.expiry_date)}
              </Text>
            </View>
            <Text
              className="mt-6 text-sm font-semibold text-[#22591A] md:text-lg"
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </View>
          <View className="mt-4 flex-1">
            <Text className="text-xs font-semibold text-[#22591A]">CVV</Text>
            <Text className="text-lg font-semibold text-[#22591A]">
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
          <Text className="text-lg font-medium text-[#22591A] md:text-3xl">
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
            <Text className="mb-1 text-[9px] font-extrabold text-[#22591A]">{'GOOD\nTHRU'}</Text>
            <Text className="ml-2 text-lg font-semibold text-[#22591A]">
              {formatExpiryDate(cardDetails.expiry_date)}
            </Text>
          </View>
          <Text className="mt-6 text-sm font-semibold text-[#22591A] md:text-lg" numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        <View className="flex-1 md:mt-4">
          <Text className="text-xs font-semibold text-[#22591A]">CVV</Text>
          <Text className="font-semibold text-[#22591A] md:text-lg">
            {cardDetails.card_security_code}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface CardActionsProps {
  isCardFrozen: boolean;
  canUnfreeze: boolean;
  isFreezing: boolean;
  isCardFlipped: boolean;
  isLoadingCardDetails: boolean;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
  isWithdrawFromCardAllowed: boolean;
  isRain: boolean;
}

function CardActions({
  isCardFrozen,
  canUnfreeze,
  isFreezing,
  isCardFlipped,
  isLoadingCardDetails,
  onCardDetails,
  onFreezeToggle,
  isWithdrawFromCardAllowed,
  isRain,
}: CardActionsProps) {
  const [isManageSheetOpen, setIsManageSheetOpen] = useState(false);
  const showManageButton = isRain || !isCardFrozen || canUnfreeze;

  return (
    <View className="mb-8 flex-row items-center justify-evenly">
      {isWithdrawFromCardAllowed && (
        <DepositToCardModal
          trigger={
            <CircularActionButton
              icon={getAsset('images/card_actions_fund.png')}
              label="Add funds"
              onPress={() => {}}
            />
          }
        />
      )}
      <CircularActionButton
        icon={getAsset('images/card_actions_details.png')}
        label={isCardFlipped ? 'Hide details' : 'Card details'}
        onPress={onCardDetails}
        isLoading={isLoadingCardDetails}
      />
      {showManageButton && (
        <View className="flex-1">
          <Dialog open={isManageSheetOpen} onOpenChange={setIsManageSheetOpen}>
            <DialogTrigger asChild>
              <View className="items-center">
                <Pressable
                  onPress={() => setIsManageSheetOpen(true)}
                  className="items-center justify-center rounded-full bg-[#303030]"
                  style={{ width: 50, height: 50 }}
                >
                  <Settings size={24} color="#BFBFBF" />
                </Pressable>
                <Text className="mt-2 text-[#BFBFBF]">Manage</Text>
              </View>
            </DialogTrigger>
            <DialogContent className="mt-[5vh] w-screen max-w-full justify-start px-4 pb-6 pt-4">
              <DialogHeader className="flex-row items-center justify-center">
                <DialogTitle className="native:text-2xl text-xl font-semibold">Manage</DialogTitle>
              </DialogHeader>
              <View className="gap-2 pb-4">
                {isRain && (
                  <ManagePinModal
                    trigger={
                      <Pressable
                        className="flex-row items-center gap-4 rounded-2xl bg-[#1E1E1E] px-5 py-4"
                        onPress={() => setIsManageSheetOpen(false)}
                      >
                        <View className="items-center justify-center rounded-full bg-[#303030] p-3">
                          <KeyRound size={20} color="white" />
                        </View>
                        <Text className="text-base font-bold text-white">PIN</Text>
                      </Pressable>
                    }
                  />
                )}
                {(!isCardFrozen || canUnfreeze) && (
                  <Pressable
                    className="flex-row items-center gap-4 rounded-2xl bg-[#1E1E1E] px-5 py-4"
                    onPress={() => {
                      setIsManageSheetOpen(false);
                      onFreezeToggle();
                    }}
                    disabled={isFreezing}
                  >
                    {isFreezing ? (
                      <View
                        className="items-center justify-center"
                        style={{ width: 44, height: 44 }}
                      >
                        <ActivityIndicator size="small" color="white" />
                      </View>
                    ) : (
                      <Image
                        source={getAsset('images/card_actions_freeze.png')}
                        style={{ width: 44, height: 44 }}
                        contentFit="contain"
                      />
                    )}
                    <Text className="text-base font-bold text-white">
                      {isCardFrozen ? 'Unfreeze' : 'Freeze'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </DialogContent>
          </Dialog>
        </View>
      )}
      {isWithdrawFromCardAllowed && (
        <WithdrawToCardModal
          trigger={
            <CircularActionButton
              icon={getAsset('images/card-withdraw-mobile.png')}
              label="Withdraw"
              onPress={() => {}}
              showBackground
            />
          }
        />
      )}
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
  const totalUsdValue = cashback?.totalUsdValue ? cashback.totalUsdValue.toFixed(2) : '0.00';

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
      className="flex-row items-center justify-between rounded-2xl bg-[#1E1E1E] p-6 web:hover:bg-[#2a2a2a] md:h-full"
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

function ViewCardTransactionsButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/activity?tab=card')}
      className="mb-4 flex-row items-center justify-between rounded-2xl bg-[#1E1E1E] p-6 web:hover:bg-[#2a2a2a] md:mb-0 md:h-full"
    >
      <Text className="text-base font-bold text-white">View card transactions</Text>
      <ChevronRight color="white" size={24} />
    </Pressable>
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

  // Gradient overlays (used with LinearGradient)
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
