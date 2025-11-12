import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import CountryFlagImage from '@/components/CountryFlagImage';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import { checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export default function ActivateCountrySelection() {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  const [loading, setLoading] = useState(true);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [processing, setProcessing] = useState(false);

  const {
    countryInfo,
    setCountryInfo,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    countryDetectionFailed,
    setCountryDetectionFailed,
  } = useCountryStore();

  // Function to get country from IP and check card access
  const getCountryFromIpAndCheckAccess = async (): Promise<{
    countryCode: string;
    countryName: string;
    isAvailable: boolean;
  } | null> => {
    try {
      const countryData = await getCountryFromIp();

      if (!countryData) return null;

      const { countryCode, countryName } = countryData;

      // Check card access via backend
      const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));
      if (!accessCheck) throw new Error('Failed to check card access');

      return {
        countryCode,
        countryName,
        isAvailable: accessCheck.hasAccess,
      };
    } catch (error) {
      console.error('Error fetching country from IP:', error);
      return null;
    }
  };

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        // First, check if we have a cached IP address
        let ip = getCachedIp();

        // If no cached IP or cache expired, fetch a new one
        if (!ip) {
          ip = await getClientIp();

          if (ip) {
            setCachedIp(ip);
          } else {
            // If IP detection fails, show country selector instead of error
            setShowCountrySelector(true);
            setLoading(false);
            return;
          }
        }

        // Check if we have a valid cached country info for this IP
        const cachedInfo = getIpDetectedCountry(ip);

        if (cachedInfo) {
          // Update countryInfo to match the IP-detected country
          setCountryInfo(cachedInfo);

          const country = COUNTRIES.find(c => c.code === cachedInfo.countryCode);
          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
          }
          // Always show country selection screen
          setShowCountrySelector(true);
          setLoading(false);
          return;
        }

        // If country detection already failed, skip retry and go straight to manual selection.
        if (countryDetectionFailed) {
          setShowCountrySelector(true);
          setLoading(false);
          return;
        }

        // Fetch new country info if cache is invalid or missing
        const fetchedCountryInfo = await getCountryFromIpAndCheckAccess();

        if (fetchedCountryInfo) {
          setIpDetectedCountry(ip, fetchedCountryInfo);
          // Clear failure flag on successful detection
          setCountryDetectionFailed(false);

          const country = COUNTRIES.find(c => c.code === fetchedCountryInfo.countryCode);

          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
          }
          // Always show country selection screen
          setShowCountrySelector(true);
        } else {
          // If country detection fails, show country selector instead of error
          setShowCountrySelector(true);
        }
      } catch (err) {
        console.error('Error fetching country:', err);
        // If any error occurs, show country selector instead of error
        setShowCountrySelector(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCountry();
  }, [
    router,
    getIpDetectedCountry,
    setIpDetectedCountry,
    getCachedIp,
    setCachedIp,
    setCountryInfo,
    countryDetectionFailed,
    setCountryDetectionFailed,
  ]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

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
    if (selectedCountry) {
      setProcessing(true);
      try {
        // Check card access via backend API
        const accessCheck = await withRefreshToken(() => checkCardAccess(selectedCountry.code));

        if (!accessCheck) throw new Error('Failed to check card access');

        // Create the updated country info
        const updatedCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: accessCheck.hasAccess,
        };

        // Update store and clear failure flag
        setCountryInfo(updatedCountryInfo);
        setCountryDetectionFailed(false);

        // If selected country is available, redirect to activate page
        if (accessCheck.hasAccess) {
          router.replace(path.CARD_ACTIVATE);
          return;
        }

        // If not available, stay on this page to show error
        setShowCountrySelector(false);
      } catch (error) {
        console.error('Error checking card access:', error);
        // On error, show as unavailable
        const unavailableCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: false,
        };

        setCountryInfo(unavailableCountryInfo);
        setShowCountrySelector(false);
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleChangeCountry = () => {
    setShowCountrySelector(true);
  };

  if (loading) {
    return <LoadingView />;
  }

  return (
    <PageLayout desktopOnly>
      <View className="w-full max-w-lg mx-auto pt-12 px-4">
        <View className="flex-row items-center justify-between mb-10">
          <Pressable onPress={goBack} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Solid card
          </Text>
          <View className="w-10" />
        </View>

        {showCountrySelector ? (
          <>
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
          </>
        ) : countryInfo && !countryInfo.isAvailable ? (
          <View className="flex-1 justify-center">
            <View className="bg-[#1C1C1C] rounded-[20px] px-10 py-8 w-full items-center">
              <CountryUnavailableView
                countryName={countryInfo.countryName}
                countryCode={countryInfo.countryCode}
                onChangeCountry={handleChangeCountry}
              />
            </View>
          </View>
        ) : null}
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
      <Pressable className="flex-1 bg-black/50 justify-center items-center" onPress={onClose}>
        <Pressable
          className="bg-[#333331] rounded-2xl w-[90%] max-w-md"
          onPress={e => e.stopPropagation()}
        >
          <View className="p-4">
            <TextInput
              className="bg-[#1A1A1A] rounded-xl px-4 h-12 text-white mb-4"
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
                  className="py-3 px-4 web:hover:bg-white/10 rounded-lg"
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
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">
          Country of residence
        </Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Please select your country of residence to activate your Solid card
        </Text>

        {selectedCountry && (
          <View className="items-center mb-6">
            <CountryFlagImage isoCode={selectedCountry.code} size={110} className="mb-2" />
          </View>
        )}
        <>
          <Pressable onPress={onOpenDropdown}>
            <View className="bg-[#1A1A1A] rounded-xl px-4 h-12 flex-row items-center justify-between mt-2 mb-6 border border-[#898989]">
              <Text className="text-white">
                {selectedCountry ? selectedCountry.name : 'Select country'}
              </Text>
              <ChevronDown color="white" size={20} />
            </View>
          </Pressable>

          <Button
            className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
            onPress={onOk}
            disabled={!selectedCountry || processing}
          >
            {processing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-base font-bold text-black">Ok</Text>
            )}
          </Button>
        </>
      </View>
    </View>
  );
}

// Country Unavailable View
interface CountryUnavailableViewProps {
  countryName: string;
  countryCode: string;
  onChangeCountry: () => void;
}

function CountryUnavailableView({
  countryName,
  countryCode,
  onChangeCountry,
}: CountryUnavailableViewProps) {
  return (
    <>
      <CountryFlagImage isoCode={countryCode} size={110} className="mt-4 mb-6" />
      <Text className="text-white text-2xl font-bold mb-4 text-center">
        {`We're not ready for ${countryName} just yet!`}
      </Text>
      <Text className="text-[#ACACAC] text-center font-weight-400 mb-6 leading-6">
        {`Unfortunately, Solid card isn't available in ${countryName} yet. Please select a different country or check back later.`}
      </Text>
      <Button className="rounded-xl h-11 w-full mt-6 bg-[#94F27F]" onPress={onChangeCountry}>
        <Text className="text-base font-bold text-black">Change country</Text>
      </Button>
    </>
  );
}

// Loading View
function LoadingView() {
  return (
    <PageLayout desktopOnly scrollable={false}>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#94F27F" />
        <Text className="mt-4 text-white/70">Loading...</Text>
      </View>
    </PageLayout>
  );
}

