import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import CountryFlagImage from '@/components/CountryFlagImage';
import PageLayout from '@/components/PageLayout';
import { RegionUnavailableView } from '@/components/RegionUnavailable';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import { checkProductAccess, resolveCountryAccess } from '@/lib/countryAccess';
import { useCountryStore } from '@/store/useCountryStore';

export default function CountrySelection() {
  const router = useRouter();

  // Return to wherever the flow started — the redesigned home reaches this
  // screen from its card CTAs. `/card` is a redirect shim now, and it would send
  // a user without a card straight back here, so fall back to the wallet page.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(path.HOME);
    }
  };

  // The selector renders immediately: it needs no network to be usable, and
  // gating it on the geo lookup meant a blank loading screen for as long as the
  // lookup took. Detection only preselects a country once it lands.
  const [showCountrySelector, setShowCountrySelector] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [processing, setProcessing] = useState(false);

  const { countryInfo, setCountryInfo } = useCountryStore(
    useShallow(state => ({
      countryInfo: state.countryInfo,
      setCountryInfo: state.setCountryInfo,
    })),
  );

  // Detect where the user is so the selector opens on their country. Picking by
  // hand stays available even when detection succeeds, because the IP is only a
  // guess at residence — so this never blocks the screen, and a failure just
  // leaves the field empty.
  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      try {
        const access = await resolveCountryAccess('card', 'card_country_selection');

        if (cancelled || !access) return;

        const country = COUNTRIES.find(c => c.code === access.countryCode);

        // Don't stomp a country the user picked while detection was in flight.
        if (country) {
          setSelectedCountry(current => current ?? country);
          setSearchQuery(current => current || country.name);
        }
      } catch (error) {
        console.error('Error detecting country:', error);
      }
    };

    void detect();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const handleChangeCountry = () => {
    setShowCountrySelector(true);
  };

  const handleOpenDropdown = () => {
    setSearchQuery('');
    setShowDropdown(true);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setSearchQuery(country.name);
    setShowDropdown(false);
  };

  const handleCountrySelectorOk = async () => {
    if (!selectedCountry) return;

    setProcessing(true);
    try {
      const hasAccess = await checkProductAccess('card', selectedCountry.code);

      setCountryInfo({
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        // A failed check is not a yes: fall through to the unavailable pop-up
        // rather than sending the user into a flow the issuer will reject.
        isAvailable: hasAccess === true,
        source: 'manual',
      });

      if (hasAccess) {
        router.push({ pathname: '/card/activate', params: { countryConfirmed: 'true' } });
        return;
      }

      setShowCountrySelector(false);
    } finally {
      setProcessing(false);
    }
  };

  // Card isn't issued where they are — show what Solid still does for them
  // instead of a dead end, and record the country as a lead.
  if (!showCountrySelector && countryInfo && !countryInfo.isAvailable) {
    return (
      <RegionUnavailableView
        product="card"
        source="card_country_selection"
        geo={{
          countryCode: countryInfo.countryCode,
          countryName: countryInfo.countryName,
          state: countryInfo.state,
          city: countryInfo.city,
          detectionSource: countryInfo.source ?? 'ip',
        }}
        onBack={goBack}
        onContinue={() => router.replace(path.HOME)}
        onChangeCountry={handleChangeCountry}
      />
    );
  }

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg px-4 pt-12">
        <View className="mb-10 flex-row items-center justify-between">
          <BackButton onPress={goBack} />
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
            Solid card
          </Text>
          <View className="w-[50px]" />
        </View>

        <CountrySelector
          selectedCountry={selectedCountry}
          onOpenDropdown={handleOpenDropdown}
          onOk={handleCountrySelectorOk}
          processing={processing}
        />
        <CountryDropdown
          visible={showDropdown}
          searchQuery={searchQuery}
          filteredCountries={filteredCountries}
          onClose={() => setShowDropdown(false)}
          onSearchChange={setSearchQuery}
          onCountrySelect={handleCountrySelect}
        />
      </View>
    </PageLayout>
  );
}

// Country Dropdown Modal Component
interface CountryDropdownProps {
  visible: boolean;
  searchQuery: string;
  filteredCountries: Country[];
  onClose: () => void;
  onSearchChange: (text: string) => void;
  onCountrySelect: (country: Country) => void;
}

function CountryDropdown({
  visible,
  searchQuery,
  filteredCountries,
  onClose,
  onSearchChange,
  onCountrySelect,
}: CountryDropdownProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <Pressable
          className="w-[90%] max-w-md rounded-2xl bg-[#333331]"
          onPress={e => e.stopPropagation()}
        >
          <View className="p-4">
            <TextInput
              className="mb-4 h-12 rounded-xl bg-[#1A1A1A] px-4 text-white"
              placeholder="Search countries..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
            <ScrollView
              className="max-h-[320px]"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {filteredCountries.map(country => (
                <Pressable
                  key={country.code}
                  className="rounded-lg px-4 py-3 web:hover:bg-white/10"
                  onPress={() => onCountrySelect(country)}
                >
                  <Text className="text-white">{country.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Country Selector Component
interface CountrySelectorProps {
  selectedCountry: Country | null;
  onOpenDropdown: () => void;
  onOk: () => void;
  processing?: boolean;
}

function CountrySelector({
  selectedCountry,
  onOpenDropdown,
  onOk,
  processing,
}: CountrySelectorProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">
          Country of residence
        </Text>
        <Text className="mb-6 text-center text-sm text-white/60">
          Please select your country of residence to see if the Solid card is available there
        </Text>

        {selectedCountry && (
          <View className="mb-6 items-center">
            <CountryFlagImage
              isoCode={selectedCountry.code}
              size={110}
              className="mb-2"
              countryName={selectedCountry.name}
            />
          </View>
        )}

        <Pressable onPress={onOpenDropdown}>
          <View className="mb-6 mt-2 h-12 flex-row items-center justify-between rounded-xl border border-[#898989] bg-[#1A1A1A] px-4">
            <Text className="text-white">
              {selectedCountry ? selectedCountry.name : 'Select country'}
            </Text>
            <ChevronDown color="white" size={20} />
          </View>
        </Pressable>

        <Button
          variant="brand"
          className="mb-4 w-full"
          onPress={onOk}
          disabled={!selectedCountry || processing}
        >
          {processing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text className="text-base font-bold text-black">Ok</Text>
          )}
        </Button>
      </View>
    </View>
  );
}
