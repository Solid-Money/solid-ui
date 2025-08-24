import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DepositOptionModal } from '@/components/DepositOption';
import { FAQs } from '@/components/FAQ';
import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import SavingCountUp from '@/components/SavingCountUp';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { useDimension } from '@/hooks/useDimension';
import { fontSize } from '@/lib/utils';
import SavingDepositBenefits from './SavingDepositBenefits';
import SavingDepositImage from './SavingDepositImage';
import SavingDepositTitle from './SavingDepositTitle';

export default function SavingsEmptyState() {
  const { isScreenMedium } = useDimension();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {!isScreenMedium && <NavbarMobile />}
        {isScreenMedium && <Navbar />}
        <View className="w-full max-w-7xl mx-auto gap-8 md:gap-16 px-4 pt-4 pb-8">
          {isScreenMedium ? (
            <View className="md:flex-row justify-between md:items-center gap-y-4">
              <View className="flex-row items-center">
                <Text className="text-5xl md:text-8xl text-foreground font-medium">$</Text>
                <SavingCountUp
                  balance={0}
                  apy={0}
                  lastTimestamp={0}
                  principal={0}
                  classNames={{
                    wrapper: 'text-foreground',
                    decimalSeparator: 'text-2xl md:text-4.5xl font-medium',
                  }}
                  styles={{
                    wholeText: {
                      fontSize: isScreenMedium ? fontSize(6) : fontSize(3),
                      fontWeight: 'medium',
                      fontFamily: 'MonaSans_500Medium',
                      color: '#ffffff',
                      marginRight: -2,
                    },
                    decimalText: {
                      fontSize: isScreenMedium ? fontSize(2.5) : fontSize(1.5),
                      fontWeight: 'medium',
                      fontFamily: 'MonaSans_500Medium',
                      color: '#ffffff',
                    },
                  }}
                />
              </View>

              <View className="flex-row items-center gap-5">
                <DepositOptionModal />
              </View>
            </View>
          ) : (
            <Text className="text-xl font-semibold">Home</Text>
          )}

          <LinearGradient
            colors={['rgba(156, 48, 235, 0.3)', 'rgba(156, 48, 235, 0.2)']}
            style={{
              borderRadius: 20,
              padding: isScreenMedium ? 40 : 20,
              gap: isScreenMedium ? 96 : 40,
            }}
          >
            {isScreenMedium ? (
              <View className="flex-col md:flex-row justify-between gap-10 md:gap-0">
                <View className="justify-between gap-10 md:gap-0 w-full max-w-2xl">
                  <SavingDepositTitle />
                  <SavingDepositBenefits />
                </View>
                <View>
                  <SavingDepositImage />
                </View>
              </View>
            ) : (
              <View className="justify-between gap-y-6">
                <SavingDepositImage />
                <SavingDepositTitle />
                <SavingDepositBenefits />
              </View>
            )}
          </LinearGradient>
          {!isScreenMedium && <DepositOptionModal />}
          <FAQs faqs={faqs} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
