import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { CircularActionButton } from '@/components/Card/CircularActionButton';
import Loading from '@/components/Loading';
import Navbar from '@/components/Navbar';
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
  const router = useRouter();

  const availableBalance = cardDetails?.balances.available;
  const availableAmount = Number(availableBalance?.amount || '0').toString();
  const isCardFrozen = cardDetails?.status === CardStatus.FROZEN;

  const handleBackPress = () => {
    router.canGoBack() ? router.back() : router.replace('/');
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
    <View className="flex-1 bg-background px-4">
      {isScreenMedium && <Navbar />}

      <ScrollView className="flex-1" contentContainerClassName="flex-grow">
        <View className="w-full max-w-lg mx-auto pt-8">
          <CardHeader onBackPress={handleBackPress} />

          <View className="flex-1">
            <BalanceDisplay amount={availableAmount} />
            <CardImageSection isScreenMedium={isScreenMedium} isCardFrozen={isCardFrozen} />
            <CardActions
              isCardFrozen={isCardFrozen}
              isFreezing={isFreezing}
              onAddFunds={() => router.push(path.CARD_DEPOSIT)}
              onCardDetails={() => setIsCardImageModalOpen(true)}
              onFreezeToggle={handleFreezeToggle}
            />
            <ViewTransactionsButton onPress={() => router.push(path.CARD_TRANSACTIONS)} />
          </View>
        </View>
      </ScrollView>

      <CardImageModal
        isOpen={isCardImageModalOpen}
        onOpenChange={setIsCardImageModalOpen}
        cardImageUrl={cardDetails?.card_image_url}
      />
    </View>
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
    : require('@/assets/images/activate_card_steps_desktop.png');

  const desktopImageAspectRatio = isCardFrozen ? 1063 / 656 : 1024 / 612;

  return (
    <View className="items-center my-12">
      {isScreenMedium ? (
        <Image
          source={desktopImagePath}
          alt="Solid Card"
          style={{ width: '100%', aspectRatio: desktopImageAspectRatio }}
          contentFit="contain"
        />
      ) : (
        <Image
          source={require('@/assets/images/card_details.png')}
          alt="Solid Card"
          style={{ width: '80%', aspectRatio: 414 / 693 }}
          contentFit="contain"
        />
      )}
    </View>
  );
}

interface CardActionsProps {
  isCardFrozen: boolean;
  isFreezing: boolean;
  onAddFunds: () => void;
  onCardDetails: () => void;
  onFreezeToggle: () => Promise<void>;
}

function CardActions({
  isCardFrozen,
  isFreezing,
  onAddFunds,
  onCardDetails,
  onFreezeToggle,
}: CardActionsProps) {
  return (
    <View className="flex-row justify-center space-x-12 items-center mb-8">
      <CircularActionButton
        icon={require('@/assets/images/card_actions_fund.png')}
        label="Add funds"
        onPress={onAddFunds}
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

interface ViewTransactionsButtonProps {
  onPress: () => void;
}

function ViewTransactionsButton({ onPress }: ViewTransactionsButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-[#1E1E1E] rounded-xl flex-row items-center justify-between p-4 mb-8"
    >
      <Text className=" text-base font-bold text-white">View transactions</Text>
      <ChevronRight color="white" size={22} />
    </Pressable>
  );
}

interface CardImageModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  cardImageUrl?: string;
}

function CardImageModal({ isOpen, onOpenChange, cardImageUrl }: CardImageModalProps) {
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
      <View className="items-center">
        {cardImageUrl ? (
          <Image
            source={{ uri: cardImageUrl }}
            alt="Full Card Details"
            style={{ width: '100%', aspectRatio: 1.6, maxWidth: 400 }}
            contentFit="contain"
          />
        ) : (
          <Text className="text-gray-400">Card image not available</Text>
        )}
      </View>
    </ResponsiveModal>
  );
}
