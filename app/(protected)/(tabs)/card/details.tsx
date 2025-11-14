import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, View } from 'react-native';

import AddToWalletModal from '@/components/Card/AddToWalletModal';
import { CircularActionButton } from '@/components/Card/CircularActionButton';
import DepositToCardModal from '@/components/Card/DepositToCardModal';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useCardDetailsReveal } from '@/hooks/useCardDetailsReveal';
import { useDimension } from '@/hooks/useDimension';
import { freezeCard, unfreezeCard } from '@/lib/api';
import { CardHolderName, CardStatus } from '@/lib/types';

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

  const availableBalance = cardDetails?.balances.available;
  const availableAmount = Number(availableBalance?.amount || '0').toString();
  const isCardFrozen = cardDetails?.status === CardStatus.FROZEN;

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
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

  const handleCardDetailsLoaded = () => {
    // Once data is loaded, flip the card immediately
    setIsLoadingCardDetails(false);
    setIsCardFlipped(true);

    Animated.spring(flipAnimation, {
      toValue: 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <PageLayout desktopOnly contentClassName="px-4" isLoading={isLoading}>
      <View className="w-full max-w-lg mx-auto pt-8">
        <CardHeader onBackPress={handleBackPress} />

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
          <CashbackDisplay cashback={cardDetails?.cashback} />
          <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
          <ViewTransactionsButton onPress={() => router.push(path.CARD_TRANSACTIONS)} />
        </View>
      </View>

      <AddToWalletModal
        isOpen={isAddToWalletModalOpen}
        onOpenChange={setIsAddToWalletModalOpen}
        trigger={<></>}
      />
    </PageLayout>
  );
}

function CardHeader({ onBackPress }: CardHeaderProps) {
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

  const desktopImageAspectRatio = isCardFrozen ? 531 / 328 : 512 / 305;

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
      className="items-center mt-12 mb-6"
      style={{
        paddingHorizontal: isCardFrozen || !isScreenMedium ? 0 : 9.5,
        paddingVertical: isCardFrozen || !isScreenMedium ? 0 : 11.5,
      }}
    >
      <View style={{ position: 'relative', width: isScreenMedium ? '100%' : '80%' }}>
        {/* Front of card */}
        <Animated.View
          style={{
            backfaceVisibility: 'hidden',
            transform: [{ rotateY: frontRotation }],
            opacity: frontOpacity,
          }}
        >
          {isScreenMedium ? (
            <Image
              source={desktopImagePath}
              alt="Solid Card"
              style={{
                width: '100%',
                aspectRatio: desktopImageAspectRatio,
              }}
              contentFit="contain"
            />
          ) : (
            <Image
              source={require('@/assets/images/card_details.png')}
              alt="Solid Card"
              style={{ width: '100%', aspectRatio: 417 / 690 }}
              contentFit="contain"
            />
          )}
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
          {isScreenMedium ? (
            <Image
              source={desktopImagePath}
              alt="Solid Card"
              style={{
                width: '100%',
                aspectRatio: desktopImageAspectRatio,
              }}
              contentFit="contain"
            />
          ) : (
            <Image
              source={require('@/assets/images/card_details.png')}
              alt="Solid Card"
              style={{ width: '100%', aspectRatio: 417 / 690 }}
              contentFit="contain"
            />
          )}
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
    if (cardDetails && !isLoading && !error) {
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

  // Don't render if still loading, error, or no data
  if (isLoading || error || !cardDetails) {
    return null;
  }

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
          <Text className="text-3xl font-medium" style={{ color: '#2E6A25' }}>
            {formatCardNumber(cardDetails.card_number)}
          </Text>
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
            <Text className="text-lg font-semibold mt-6" style={{ color: '#2E6A25' }}>
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
    <View className="absolute inset-0 rounded-2xl p-6 mt-24 justify-center">
      <View className="mb-5">
        <Text className="text-3xl font-medium" style={{ color: '#2E6A25' }}>
          {formatCardNumber(cardDetails.card_number)}
        </Text>
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
          <Text className="text-lg font-semibold mt-6" style={{ color: '#2E6A25' }}>
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
    <View className="flex-row justify-center space-x-8 items-center mb-8">
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

interface CashbackDisplayProps {
  cashback?: {
    monthlyFuseAmount: number;
    monthlyUsdValue: number;
    percentage: number;
  };
}

function CashbackDisplay({ cashback }: CashbackDisplayProps) {
  const totalUsdValue = cashback?.monthlyUsdValue ? Math.round(cashback.monthlyUsdValue) : 0;
  const cashbackPercentage = cashback?.percentage || 0;

  return (
    <LinearGradient
      colors={['rgba(104, 216, 82, 0.25)', 'rgba(104, 216, 82, 0.175)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      className="rounded-2xl p-6 mb-4 flex-row"
    >
      <View className="flex-1 pr-4">
        <Text className="text-white/70 mb-1">Cashback</Text>
        <Text className="text-[#94F27F] text-2xl font-semibold">${totalUsdValue} this month</Text>
      </View>
      <View className="w-[1px] bg-[#3D5A3B] mx-4 my-[-24px]" />
      <View className="flex-1 pl-8 justify-center">
        <Text className="text-white text-lg leading-6">
          you are receiving{'\n'}
          <Text className="text-[#94F27F] text-lg font-bold">{cashbackPercentage * 100}%</Text>{' '}
          cashback on all purchases
        </Text>
      </View>
    </LinearGradient>
  );
}

interface AddToWalletButtonProps {
  onPress: () => void;
}

function AddToWalletButton({ onPress }: AddToWalletButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1E1E1E] rounded-2xl flex-row items-center justify-between p-4 mb-4 h-14"
    >
      <View className="flex-row items-center flex-1">
        <Text className="flex-1 text-base font-bold text-white mr-3">Add to wallet</Text>
        <View className="flex-row items-center mr-8">
          <Image
            source={require('@/assets/images/apple_pay.png')}
            style={{ width: 49, height: 22 }}
            contentFit="contain"
          />
          <View className="w-px h-8 bg-white/50 mx-3" />
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

interface ViewTransactionsButtonProps {
  onPress: () => void;
}

function ViewTransactionsButton({ onPress }: ViewTransactionsButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1E1E1E] rounded-2xl flex-row items-center justify-between p-4 mb-28 h-14"
    >
      <Text className=" text-base font-bold text-white">View transactions</Text>
      <ChevronRight color="white" size={22} />
    </Pressable>
  );
}
