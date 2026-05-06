import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import AuthButton from '@/components/AuthButton';
import GetCardButton from '@/components/CardWaitlist/GetCardButton';
import SolidCardSummary from '@/components/CardWaitlist/SolidCardSummary';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { getAsset } from '@/lib/assets';

const MODAL_STATE: ModalState = { name: 'card-fees', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

interface CardFeesModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

type DetailItemProps = {
  icon: ReturnType<typeof getAsset>;
  title: string;
  description: React.ReactNode;
};

const DetailItem = ({ icon, title, description }: DetailItemProps) => (
  <View className="flex-row gap-3">
    <Image source={icon} style={{ width: 50, height: 50 }} contentFit="contain" />
    <View className="flex-1 gap-1">
      <Text className="text-base font-semibold">{title}</Text>
      {typeof description === 'string' ? (
        <Text className="text-sm leading-5 text-muted-foreground">{description}</Text>
      ) : (
        description
      )}
    </View>
  </View>
);

const CardFeesModal = ({ isOpen, onOpenChange }: CardFeesModalProps) => {
  return (
    <ResponsiveModal
      currentModal={MODAL_STATE}
      previousModal={CLOSE_STATE}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={null}
      title="Fees and charges"
      titleClassName="items-center w-full"
      contentKey="card-fees"
      contentClassName="md:max-w-md"
      shouldAnimate={false}
    >
      <View className="gap-6">
        <LinearGradient
          colors={['rgba(148, 242, 127, 0.25)', 'rgba(148, 242, 127, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="overflow-hidden"
          style={{ borderRadius: 20, overflow: 'hidden' }}
        >
          <View className="relative p-5">
            <View className="absolute top-0" style={{ right: -125 }}>
              <Image
                source={getAsset('images/cards.png')}
                style={{ width: 250, height: 280 }}
                contentFit="contain"
              />
            </View>
            <SolidCardSummary
              compact
              topUpLabel={'Zero top-up fee,\nzero monthly fee'}
            />
          </View>
        </LinearGradient>

        <View className="gap-4">
          <Text className="text-base font-semibold text-muted-foreground">More details</Text>
          <View className="gap-5">
            <DetailItem
              icon={getAsset('images/dollar-yellow.png')}
              title="No hidden fees"
              description={
                <View>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    FX fee of just 1% on non-USD transactions
                  </Text>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    No cross-border fees
                  </Text>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    No international transaction fees
                  </Text>
                </View>
              }
            />
            <DetailItem
              icon={getAsset('images/dollar-yellow.png')}
              title="Global acceptance"
              description="Spend anywhere Visa is accepted"
            />
            <DetailItem
              icon={getAsset('images/dollar-yellow.png')}
              title="Borrow against savings"
              description="Keep earning on your savings while spending"
            />
            <DetailItem
              icon={getAsset('images/card-safe.png')}
              title="Safe by design"
              description="Non-custodial, secured by passkeys"
            />
            <DetailItem
              icon={getAsset('images/card-effortless.png')}
              title="Effortless setup"
              description={
                <View>
                  <Text className="text-sm leading-5 text-muted-foreground">
                    Start using instantly.
                  </Text>
                  <View className="flex-row items-center gap-1.5">
                    <Image
                      source={getAsset('images/apple-google-pay.png')}
                      alt="Apple/Google Pay"
                      style={{ width: 82, height: 19 }}
                      contentFit="contain"
                    />
                    <Text className="text-sm leading-5 text-muted-foreground">support</Text>
                  </View>
                </View>
              }
            />
          </View>
        </View>

        <AuthButton>
          <GetCardButton className="w-full" />
        </AuthButton>
      </View>
    </ResponsiveModal>
  );
};

export default CardFeesModal;
