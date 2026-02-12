import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import CountryFlagImage from '@/components/CountryFlagImage';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useFingerprint } from '@/hooks/useFingerprint';
import { track } from '@/lib/analytics';
import {
  checkCardAccess,
  getClientIp,
  getCountryFromIp,
  verifyCountryWithFingerprint,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export default function ActivateCountrySelection() {
  const router = useRouter();
  const { getVisitorData, isAvailable: isFingerprintAvailable } = useFingerprint();

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

  const [selectionMethod, setSelectionMethod] = useState<'manual' | 'ip_detected' | 'unknown'>(
    'unknown',
  );

  const [processing, setProcessing] = useState(false);

  // Use useShallow for object selection to prevent unnecessary re-renders
  const { countryInfo, setCountryInfo, setCountryDetectionFailed } = useCountryStore(
    useShallow(state => ({
      countryInfo: state.countryInfo,
      setCountryInfo: state.setCountryInfo,
      setCountryDetectionFailed: state.setCountryDetectionFailed,
    })),
  );

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
      // Get current store state directly to avoid dependency issues
      const store = useCountryStore.getState();

      try {
        // First, check if we have a cached IP address
        let ip = store.getCachedIp();

        // If no cached IP or cache expired, fetch a new one
        if (!ip) {
          ip = await getClientIp();

          if (ip) {
            store.setCachedIp(ip);
          } else {
            // If IP detection fails, show country selector instead of error
            setShowCountrySelector(true);
            setLoading(false);
            return;
          }
        }

        // Check if we have a valid cached country info for this IP
        const cachedInfo = store.getIpDetectedCountry(ip);

        if (cachedInfo) {
          // Update countryInfo to match the IP-detected country
          store.setCountryInfo(cachedInfo);

          const country = COUNTRIES.find(c => c.code === cachedInfo.countryCode);
          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
            setSelectionMethod('ip_detected');
          }
          // Always show country selection screen
          setShowCountrySelector(true);
          setLoading(false);
          return;
        }

        // If country detection already failed, skip retry and go straight to manual selection.
        if (store.countryDetectionFailed) {
          setShowCountrySelector(true);
          setLoading(false);
          return;
        }

        // Fetch new country info if cache is invalid or missing
        const fetchedCountryInfo = await getCountryFromIpAndCheckAccess();

        if (fetchedCountryInfo) {
          store.setIpDetectedCountry(ip, fetchedCountryInfo);
          // Clear failure flag on successful detection
          store.setCountryDetectionFailed(false);

          const country = COUNTRIES.find(c => c.code === fetchedCountryInfo.countryCode);

          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
            setSelectionMethod('ip_detected');
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
  }, []);

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
    track(TRACKING_EVENTS.CARD_COUNTRY_SELECTED, {
      countryCode: country.code,
      countryName: country.name,
      selectionMethod: 'manual',
    });
    setSelectedCountry(country);
    setSearchQuery(country.name);
    setSelectionMethod('manual');
    setShowDropdown(false);
  };

  const handleCountrySelectorOk = async () => {
    if (selectedCountry) {
      setProcessing(true);
      try {
        // Always show country as unavailable - no matter which country is selected
        // This ensures users see the "country not available" message
        const unavailableCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: false,
        };

        // Update store with unavailable status
        setCountryInfo(unavailableCountryInfo);
        setCountryDetectionFailed(false);

        track(TRACKING_EVENTS.CARD_COUNTRY_AVAILABILITY_CHECKED, {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: false,
          selectionMethod: selectionMethod === 'ip_detected' ? 'ip_detected' : 'manual',
        });

        // Show the unavailable message
        setShowCountrySelector(false);
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleChangeCountry = () => {
    track(TRACKING_EVENTS.CARD_COUNTRY_CHANGE_PRESSED, {
      countryCode: countryInfo?.countryCode,
      countryName: countryInfo?.countryName,
    });
    setShowCountrySelector(true);
  };

  if (loading) {
    return <LoadingView />;
  }

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg px-4 pt-12">
        <View className="mb-10 flex-row items-center justify-between">
          <Pressable onPress={goBack} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-center text-xl font-semibold text-white md:text-2xl">
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
            <View className="w-full items-center rounded-[20px] bg-[#1C1C1C] px-10 py-8">
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
          Please select your country of residence to activate your Solid card
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
        <>
          <Pressable onPress={onOpenDropdown}>
            <View className="mb-6 mt-2 h-12 flex-row items-center justify-between rounded-xl border border-[#898989] bg-[#1A1A1A] px-4">
              <Text className="text-white">
                {selectedCountry ? selectedCountry.name : 'Select country'}
              </Text>
              <ChevronDown color="white" size={20} />
            </View>
          </Pressable>

          <Button
            className="mb-4 h-11 w-full rounded-xl bg-[#94F27F]"
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
      <CountryFlagImage
        isoCode={countryCode}
        size={110}
        className="mb-6 mt-4"
        countryName={countryName}
      />
      <Text className="mb-4 text-center text-2xl font-bold text-white">
        {`We're not ready for ${countryName} just yet!`}
      </Text>
      <Text className="font-weight-400 mb-6 text-center leading-6 text-[#ACACAC]">
        {`Unfortunately, Solid card isn't available in ${countryName} yet. Please select a different country or check back later.`}
      </Text>
      <Button className="mt-6 h-11 w-full rounded-xl bg-[#94F27F]" onPress={onChangeCountry}>
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
