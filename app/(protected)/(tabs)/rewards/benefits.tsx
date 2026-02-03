import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import PageLayout from '@/components/PageLayout';
import CompareTiersTable from '@/components/Rewards/CompareTiersTable';
import EarnPointsSection from '@/components/Rewards/EarnPointsSection';
import TierFeesTable from '@/components/Rewards/TierFeesTable';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { useTierBenefits } from '@/hooks/useRewards';

export default function RewardsBenefits() {
  const { isScreenMedium } = useDimension();
  const { data: tierBenefits, isLoading } = useTierBenefits();

  if (isLoading || !tierBenefits) {
    return <PageLayout isLoading={true}>{null}</PageLayout>;
  }

  return (
    <PageLayout isLoading={isLoading}>
      <View className="mx-auto w-full max-w-7xl gap-8 px-4 pb-24 pt-6 md:gap-12 md:py-12">
        <View className="flex-row items-center gap-6">
          <Pressable
            onPress={() => router.push(path.REWARDS)}
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-popover web:transition-colors web:hover:bg-muted"
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </Pressable>
          <Text className="text-2xl font-semibold opacity-50">Rewards</Text>
        </View>

        {isScreenMedium && (
          <View className="flex-row items-center justify-between">
            <Text className="text-5xl font-semibold">Rewards benefits</Text>
          </View>
        )}

        {!isScreenMedium && <Text className="text-3xl font-semibold">Rewards benefits</Text>}

        <EarnPointsSection />
        <CompareTiersTable tierBenefits={tierBenefits} />
        <TierFeesTable tierBenefits={tierBenefits} />
      </View>
    </PageLayout>
  );
}
