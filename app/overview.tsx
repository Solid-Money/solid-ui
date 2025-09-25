import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FAQ } from '@/components/FAQ';
import Audits from '@/components/Landing/Audits';
import HowItWorks from '@/components/Landing/HowItWorks';
import VaultBreakdownChart from '@/components/Landing/VaultBreakdownChart.web';
import VaultBreakdownTable from '@/components/Landing/VaultBreakdownTable';
import VaultInfo from '@/components/Landing/VaultInfo';
import VaultStat from '@/components/Landing/VaultStat';
import Navbar from '@/components/Navbar';
import NavbarMobile from '@/components/Navbar/NavbarMobile';
import { Text } from '@/components/ui/text';
import faqs from '@/constants/faqs';
import { howItWorks } from '@/constants/how-it-works';
import { useVaultBreakdown } from '@/hooks/useAnalytics';
import { useDimension } from '@/hooks/useDimension';
import { VaultBreakdown } from '@/lib/types';

interface SoUSDSectionProps {
  vaultBreakdown: VaultBreakdown[];
}

interface VaultBreakdownSectionProps {
  vaultBreakdown: VaultBreakdown[];
}

const SoUSDSection = ({ vaultBreakdown }: SoUSDSectionProps) => {
  return (
    <View className="gap-6 md:gap-12">
      <View className="md:flex-row justify-between md:items-center gap-6">
        <View className="flex-1 gap-6 md:gap-10">
          <View className="gap-2">
            <Text className="text-2xl md:text-4.5xl font-semibold">soUSD vault</Text>
            <Text className="text-lg text-muted-foreground font-medium">
              USD stablecoins deployed across integrated DEXs and lending protocols on Fuse.
            </Text>
          </View>
          <VaultInfo vaultBreakdown={vaultBreakdown} className="max-w-3xl" />
        </View>
        <Image
          source={require('@/assets/images/solid-dark-purple.png')}
          style={{ width: 201, height: 201 }}
          contentFit="contain"
        />
      </View>
      <VaultStat />
    </View>
  );
};

const HowSection = () => {
  return (
    <View className="gap-6">
      <Text className="text-xl md:text-3xl font-semibold">How it works?</Text>
      <View className="md:flex-row justify-between gap-4 md:gap-10">
        {howItWorks.map((how, index) => (
          <HowItWorks key={index} index={index + 1} description={how} />
        ))}
      </View>
    </View>
  );
};

const VaultBreakdownSection = ({ vaultBreakdown }: VaultBreakdownSectionProps) => {
  const [selectedBreakdown, setSelectedBreakdown] = useState(-1);

  if (!vaultBreakdown.length) return null;

  return (
    <View className="gap-6">
      <Text className="text-xl md:text-3xl font-semibold">Vault breakdown</Text>
      <View className="md:flex-row md:justify-between md:min-h-80 bg-card rounded-twice p-5 md:p-10">
        <VaultBreakdownTable
          data={vaultBreakdown}
          setSelectedBreakdown={setSelectedBreakdown}
          className="max-w-2xl"
        />
        <VaultBreakdownChart data={vaultBreakdown} selectedBreakdown={selectedBreakdown} />
      </View>
    </View>
  );
};

const AuditSection = () => {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text className="text-xl md:text-3xl font-semibold">Audits</Text>
        <Text className="text-lg text-muted-foreground font-medium">
          Solid and the underlying protocols have been audited by industry leaders in blockchain
          security.
        </Text>
      </View>
      <View className="md:flex-row justify-between bg-card rounded-twice p-5 md:px-10 md:py-8">
        <Audits className="max-w-2xl" />
      </View>
    </View>
  );
};

const FAQSection = () => {
  return (
    <View className="gap-6">
      <Text className="text-xl md:text-3xl font-semibold">Frequently asked questions</Text>
      <View className="bg-card rounded-twice p-2 md:p-6">
        <FAQ faqs={faqs} />
      </View>
    </View>
  );
};

const Landing = () => {
  const { isScreenMedium } = useDimension();
  const { data: vaultBreakdown } = useVaultBreakdown();

  return (
    <SafeAreaView
      className="bg-background text-foreground flex-1"
      edges={['right', 'left', 'bottom', 'top']}
    >
      <ScrollView className="flex-1">
        {!isScreenMedium && <NavbarMobile />}
        {isScreenMedium && <Navbar />}
        <View className="gap-8 md:gap-24 px-4 py-0 md:py-12 w-full max-w-7xl mx-auto pb-20 mb-5">
          <SoUSDSection vaultBreakdown={vaultBreakdown || []} />
          <HowSection />
          <VaultBreakdownSection vaultBreakdown={vaultBreakdown || []} />
          <AuditSection />
          <FAQSection />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Landing;
