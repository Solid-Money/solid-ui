import { useState } from 'react';
import { View } from 'react-native';

import { FAQ } from '@/components/FAQ';
import APYChart from '@/components/Landing/APYChart';
import Audits from '@/components/Landing/Audits';
import HowItWorks from '@/components/Landing/HowItWorks';
import SolidImage from '@/components/Landing/SolidImage';
import VaultBreakdownChart from '@/components/Landing/VaultBreakdownChart';
import VaultBreakdownTable from '@/components/Landing/VaultBreakdownTable';
import VaultInfo from '@/components/Landing/VaultInfo';
import VaultStat from '@/components/Landing/VaultStat';
import PageLayout from '@/components/PageLayout';
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
  const { isScreenMedium } = useDimension();

  return (
    <View className="gap-6 md:gap-12">
      <View className="justify-between gap-6 md:flex-row md:items-center">
        <View className="flex-1 gap-6 md:gap-10">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-2">
              <Text className="text-2xl font-semibold md:text-4.5xl">soUSD vault</Text>
              <Text className="max-w-60 font-medium text-muted-foreground md:max-w-full md:text-lg">
                USD stablecoins deployed across integrated DEXs and lending protocols on Fuse.
              </Text>
            </View>
            {!isScreenMedium && <SolidImage width={101} height={101} />}
          </View>
          <VaultInfo vaultBreakdown={vaultBreakdown} className="max-w-3xl" />
        </View>
        {isScreenMedium && <SolidImage />}
      </View>
      <View className="justify-between gap-6 md:flex-row md:gap-10">
        <VaultStat />
        <APYChart />
      </View>
    </View>
  );
};

const HowSection = () => {
  return (
    <View className="gap-6">
      <Text className="text-xl font-semibold md:text-3xl">How it works?</Text>
      <View className="justify-between gap-4 md:flex-row md:gap-10">
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
      <Text className="text-xl font-semibold md:text-3xl">Vault breakdown</Text>
      <View className="flex-col gap-4 rounded-twice bg-card p-5 md:min-h-80 md:flex-row md:justify-between md:p-10">
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
    <View className="justify-between gap-6 md:flex-row">
      <View className="max-w-80 gap-2">
        <Text className="text-xl font-semibold md:text-3xl">Audits</Text>
        <Text className="text-lg font-medium text-muted-foreground">
          Solid and the underlying protocols have been audited by industry leaders in blockchain
          security.
        </Text>
      </View>
      <Audits className="max-w-3xl rounded-twice bg-card p-5 md:px-10 md:py-8" />
    </View>
  );
};

const FAQSection = () => {
  return (
    <View className="justify-between gap-6 md:flex-row">
      <Text className="text-xl font-semibold md:max-w-40 md:text-3xl">
        Frequently asked questions
      </Text>
      <View className="w-full max-w-3xl rounded-twice bg-card p-2 md:p-6">
        <FAQ faqs={faqs} />
      </View>
    </View>
  );
};

const Landing = () => {
  const { data: vaultBreakdown } = useVaultBreakdown();

  return (
    <PageLayout>
      <View className="mx-auto mb-5 w-full max-w-7xl gap-8 px-4 py-0 pb-20 md:gap-24 md:py-12">
        <SoUSDSection vaultBreakdown={vaultBreakdown || []} />
        <HowSection />
        <VaultBreakdownSection vaultBreakdown={vaultBreakdown || []} />
        <AuditSection />
        <FAQSection />
      </View>
    </PageLayout>
  );
};

export default Landing;
