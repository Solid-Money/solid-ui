import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';

import PieChart from '@/components/PieChart.web';
import { Text } from '@/components/ui/text';
import { useVaultBreakdown } from '@/hooks/useAnalytics';
import VaultBreakdownTable from '@/components/Landing/VaultBreakdownTable';

const VaultBreakdownSection = () => {
  const { data: vaultBreakdown } = useVaultBreakdown();
  const [selectedBreakdown, setSelectedBreakdown] = useState(-1);

  if (!vaultBreakdown) return null;

  return (
    <View className="gap-6">
      <Text className="text-xl md:text-3xl font-semibold">Vault breakdown</Text>
      <View className="flex-row justify-between min-h-80 bg-card rounded-twice p-10">
        <VaultBreakdownTable data={vaultBreakdown} setSelectedBreakdown={setSelectedBreakdown} />
        <PieChart data={vaultBreakdown} selectedBreakdown={selectedBreakdown} />
      </View>
    </View>
  );
};

const Landing = () => {
  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        <View className="gap-8 md:gap-16 px-4 py-0 md:py-12 w-full max-w-7xl mx-auto pb-20 mb-5">
          <VaultBreakdownSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Landing;
