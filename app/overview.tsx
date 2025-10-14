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
import SolidImage from '@/components/Landing/SolidImage';
import APYChart from '@/components/Landing/APYChart';

interface SoUSDSectionProps {
  vaultBreakdown: VaultBreakdown[];
}

interface VaultBreakdownSectionProps {
  vaultBreakdown: VaultBreakdown[];
}

const SoUSDSection = ({ vaultBreakdown }: SoUSDSectionProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <View className="gap-6 md:gap-12">
      <View className="md:flex-row justify-between md:items-center gap-6">
        <View className="flex-1 gap-6 md:gap-10">
          <View className="flex-row justify-between items-center">
            <View className="gap-2 flex-1">
              <Text className="text-2xl md:text-4.5xl font-semibold">soUSD vault</Text>
              <Text className="md:text-lg text-muted-foreground font-medium max-w-60 md:max-w-full">
                USD stablecoins deployed across integrated DEXs and lending protocols on Fuse.
              </Text>
            </View>
            {!isScreenMedium && <SolidImage width={101} height={101} />}
          </View>
          <VaultInfo vaultBreakdown={vaultBreakdown} className="max-w-3xl" />
        </View>
        {isScreenMedium && <SolidImage />}
      </View>
      <View className="md:flex-row justify-between gap-6 md:gap-10">
        <VaultStat />
        <APYChart />
      </View>
    </View>
  );
};

const HowSection = () => {
  return (
    <View className="gap-6">
      <Text className="text-xl md:text-3xl font-semibold">How it works?</Text>
      <View className="md:flex-row justify-between gap-4 md:gap-10">
        {howItWorks.map((how, index) => (
          <HowItWorks
            key={index}
            index={index + 1}
            title={how.title}
            description={how.description}
            image={how.image}
          />
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
      <View className="md:flex-row md:justify-between gap-4 md:min-h-80 bg-card rounded-twice p-5 md:p-10">
        <VaultBreakdownTable
          data={vaultBreakdown}
          setSelectedBreakdown={setSelectedBreakdown}
          className="max-w-[45rem]"
        />
        <VaultBreakdownChart data={vaultBreakdown} selectedBreakdown={selectedBreakdown} />
      </View>
    </View>
  );
};

const AuditSection = () => {
  return (
    <View className="md:flex-row justify-between gap-6">
      <View className="gap-2 max-w-80">
        <Text className="text-xl md:text-3xl font-semibold">Audits</Text>
        <Text className="text-lg text-muted-foreground font-medium">
          Solid and the underlying protocols have been audited by industry leaders in blockchain
          security.
        </Text>
      </View>
      <Audits className="bg-card rounded-twice p-5 md:px-10 md:py-8 max-w-3xl" />
    </View>
  );
};

const FAQSection = () => {
  return (
    <View className="md:flex-row justify-between gap-6">
      <Text className="text-xl md:text-3xl font-semibold max-w-40">Frequently asked questions</Text>
      <View className="bg-card rounded-twice p-2 md:p-6 max-w-3xl">
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
