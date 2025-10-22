import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import AddToWalletModal from '@/components/Card/AddToWalletModal';
import { CardDetailsReveal } from '@/components/Card/CardDetailsReveal';
import { CircularActionButton } from '@/components/Card/CircularActionButton';
import DepositToCardModal from '@/components/Card/DepositToCardModal';
import Loading from '@/components/Loading';
import PageLayout from '@/components/PageLayout';
import ResponsiveModal from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useCardDetails } from '@/hooks/useCardDetails';
import { useDimension } from '@/hooks/useDimension';
import { freezeCard, unfreezeCard } from '@/lib/api';
import { CardStatus } from '@/lib/types';

interface CardHeaderProps {
  onBackPress: () => void;
}

export default function CardDetails() {
  const { data: cardDetails, isLoading, refetch } = useCardDetails();
  const { isScreenMedium } = useDimension();
  const [isFreezing, setIsFreezing] = useState(false);
  const [isCardImageModalOpen, setIsCardImageModalOpen] = useState(false);
  const [isAddToWalletModalOpen, setIsAddToWalletModalOpen] = useState(false);
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

  if (isLoading) return <Loading />;

  return (
    <PageLayout desktopOnly contentClassName="px-4">
      <View className="w-full max-w-lg mx-auto pt-8">
        <CardHeader onBackPress={handleBackPress} />

        <View className="flex-1">
          <BalanceDisplay amount={availableAmount} />
          <CardImageSection isScreenMedium={isScreenMedium} isCardFrozen={isCardFrozen} />
          <CardActions
            isCardFrozen={isCardFrozen}
            isFreezing={isFreezing}
            onCardDetails={() => setIsCardImageModalOpen(true)}
            onFreezeToggle={handleFreezeToggle}
          />
          <CashbackDisplay cashback={cardDetails?.cashback} />
          <AddToWalletButton onPress={() => setIsAddToWalletModalOpen(true)} />
          <ViewTransactionsButton onPress={() => router.push(path.CARD_TRANSACTIONS)} />
        </View>
      </View>

      <CardImageModal isOpen={isCardImageModalOpen} onOpenChange={setIsCardImageModalOpen} />

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
  return (
    <View className="items-center mt-10">
      <Text className="text-[50px] font-semibold">${amount}</Text>
      <Text className="text-base opacity-70">Spendable balance</Text>
    </View>
  );
}

interface CardImageSectionProps {
  isScreenMedium: boolean;
  isCardFrozen: boolean;
}

function CardImageSection({ isScreenMedium, isCardFrozen }: CardImageSectionProps) {
  const desktopImagePath = isCardFrozen
    ? require('@/assets/images/card_frozen.png')
    : require('@/assets/images/activate_card_steps.png');

  const desktopImageAspectRatio = isCardFrozen ? 531 / 328 : 512 / 305;

  return (
    <View
      className="items-center my-12"
      style={{
        paddingHorizontal: isCardFrozen || !isScreenMedium ? 0 : 9.5,
        paddingVertical: isCardFrozen || !isScreenMedium ? 0 : 11.5,
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
          style={{ width: '80%', aspectRatio: 417 / 690 }}
          contentFit="contain"
        />
      )}
    </View>
  );
}

interface CardActionsProps {
  isCardFrozen: boolean;
  isFreezing: boolean;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
}

function CardActions({
  isCardFrozen,
  isFreezing,
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
        label="Card details"
        onPress={onCardDetails}
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
      className="bg-[#1E1E1E] rounded-2xl flex-row items-center justify-between p-4 mb-8 h-14"
    >
      <Text className=" text-base font-bold text-white">View transactions</Text>
      <ChevronRight color="white" size={22} />
    </Pressable>
  );
}

interface CardImageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function CardImageModal({ isOpen, onOpenChange }: CardImageModalProps) {
  return (
    <ResponsiveModal
      currentModal={{ name: 'cardImage', number: 1 }}
      previousModal={{ name: 'close', number: 0 }}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Card Details"
      contentClassName="md:max-w-2xl"
      contentKey="cardImage"
      trigger={<></>}
    >
      <CardDetailsReveal onClose={() => onOpenChange(false)} />
    </ResponsiveModal>
  );
}
