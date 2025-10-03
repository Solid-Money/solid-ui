import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import CountryFlagImage from '@/components/CountryFlagImage';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import { useDimension } from '@/hooks/useDimension';
import { checkCardAccess, getCountryFromIp } from '@/lib/api';
import { CountryInfo } from '@/lib/types';
import { shouldRefetchCountry, useCountryStore } from '@/store/useCountryStore';

export default function CountrySelection() {
  const router = useRouter();
  const { isScreenMedium } = useDimension();
  const [countryInfo, setCountryInfo] = useState<CountryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notifyClicked, setNotifyClicked] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

  const { countryInfo: cachedCountryInfo, lastFetchTime, setCountryInfo: setCachedCountryInfo } = useCountryStore();

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        // Check if we have cached country info that's still valid
        if (cachedCountryInfo && !shouldRefetchCountry(lastFetchTime)) {
          setCountryInfo(cachedCountryInfo);
          const country = COUNTRIES.find((c) => c.code === cachedCountryInfo.countryCode);
          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
          }
          
          // If country is available, proceed directly to card activation
          if (cachedCountryInfo.isAvailable) {
            router.replace(path.CARD_ACTIVATE_MOBILE);
            return;
          }
          setLoading(false);
          return;
        }

        // Fetch new country info if cache is invalid or missing
        const info = await getCountryFromIp();
        if (info) {
          setCountryInfo(info);
          setCachedCountryInfo(info); // Cache the country info
          
          const country = COUNTRIES.find((c) => c.code === info.countryCode);
          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
          }
          
          // If country is available, proceed directly to card activation
          if (info.isAvailable) {
            router.replace(path.CARD_ACTIVATE_MOBILE);
            return;
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching country:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCountry();
  }, [router, cachedCountryInfo, lastFetchTime, setCachedCountryInfo]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter((country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleNotifyByMail = () => {
    setNotifyClicked(true);
  };

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
    if (selectedCountry) {
      try {
        // Check card access via backend API
        const accessCheck = await checkCardAccess(selectedCountry.code);
        
        // Create the updated country info
        const updatedCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: accessCheck.hasAccess,
        };
        
        // Update both local and cached state
        setCountryInfo(updatedCountryInfo);
        setCachedCountryInfo(updatedCountryInfo);
        
        // If selected country is available, proceed directly to card activation
        if (accessCheck.hasAccess) {
          router.replace(path.CARD_ACTIVATE_MOBILE);
          return;
        }
        
        setShowCountrySelector(false);
        setNotifyClicked(false);
      } catch (error) {
        console.error('Error checking card access:', error);
        // On error, show as unavailable
        const unavailableCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: false,
        };
        
        setCountryInfo(unavailableCountryInfo);
        setCachedCountryInfo(unavailableCountryInfo);
        setShowCountrySelector(false);
        setNotifyClicked(false);
      }
    }
  };

  if (loading) {
    return <LoadingView isScreenMedium={isScreenMedium} />;
  }

  if (error || !countryInfo) {
    return <ErrorView isScreenMedium={isScreenMedium} onBack={() => router.back()} />;
  }

  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}

      <View className="w-full max-w-lg mx-auto pt-12 px-4">
        <View className="flex-row items-center justify-between mb-10">
          <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
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
         ) : (
           <View className="flex-1 justify-center">
             <View className="bg-[#1C1C1C] rounded-xl px-10 py-8 w-full max-w-md items-center">
               {notifyClicked ? (
                 <NotifyConfirmationView
                   countryName={countryInfo.countryName}
                   countryCode={countryInfo.countryCode}
                   onOk={() => router.back()}
                 />
               ) : (
                 <CountryUnavailableView
                   countryName={countryInfo.countryName}
                   countryCode={countryInfo.countryCode}
                   onChangeCountry={handleChangeCountry}
                   onNotifyByMail={handleNotifyByMail}
                 />
               )}
             </View>
           </View>
         )}
      </View>
    </View>
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
          onPress={(e) => e.stopPropagation()}
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
              {filteredCountries.map((country) => (
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
}

function CountrySelector({ selectedCountry, onOpenDropdown, onOk }: CountrySelectorProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">
          Country of residence
        </Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Check to see which Membership features are available to you today
        </Text>

        {selectedCountry && (
          <View className="items-center mb-6">
            <CountryFlagImage 
              isoCode={selectedCountry.code}
              size={110}
              style={{ marginBottom: 8 }}
            />
          </View>
        )}
        <Pressable onPress={onOpenDropdown}>
          <View className="bg-[#1A1A1A] rounded-xl px-4 h-12 flex-row items-center mt-2 mb-6 border border-[#898989]">
            <Text className="text-white">
              {selectedCountry ? selectedCountry.name : 'Select country'}
            </Text>
          </View>
        </Pressable>

        <Button
          className="rounded-xl h-11 w-full mb-4 bg-[#94F27F]"
          onPress={onOk}
          disabled={!selectedCountry}
        >
          <Text className="text-base font-bold text-black">Ok</Text>
        </Button>
      </View>
    </View>
  );
}

// Country Unavailable View
interface CountryUnavailableViewProps {
  countryName: string;
  countryCode: string;
  onChangeCountry: () => void;
  onNotifyByMail: () => void;
}

function CountryUnavailableView({
  countryName,
  countryCode,
  onChangeCountry,
  onNotifyByMail,
}: CountryUnavailableViewProps) {
  return (
    <>
      <CountryFlagImage 
        isoCode={countryCode}
        size={110}
        style={{ marginTop: 16, marginBottom: 24 }}
      />
      <Text className="text-white text-2xl font-bold mb-4 text-center">
        We're not ready for {countryName} just yet!
      </Text>
      <Text className="text-[#ACACAC] text-center font-weight-400 mb-6 leading-6">
        Unfortunately, Solid card isn't available here yet. We can let you know as soon as it is.
      </Text>
      <Pressable onPress={onChangeCountry} className="mb-6 web:hover:opacity-70">
        <Text className="text-white font-bold text-base">Change country</Text>
      </Pressable>
        <Button
          className="rounded-xl h-11 w-full mt-6 bg-[#94F27F]"
          onPress={onNotifyByMail}
        >
          <Text className="text-base font-bold text-black">Notify by mail</Text>
        </Button>
    </>
  );
}

// Notify Confirmation View
interface NotifyConfirmationViewProps {
  countryName: string;
  countryCode: string;
  onOk: () => void;
}

function NotifyConfirmationView({ countryName, countryCode, onOk }: NotifyConfirmationViewProps) {
  return (
    <>
      <CountryFlagImage 
        isoCode={countryCode}
        size={110}
        style={{ marginBottom: 24 }}
      />
      <Text className="text-white text-2xl font-semibold mb-4 text-center">Thanks</Text>
      <Text className="text-[#ACACAC] text-center mb-8 leading-6">
        We'll let you know as soon as Cash cards become available in {countryName}. Hopefully very
        soon!
      </Text>
      <Button
        className="rounded-xl h-11 w-full mt-6 mb-4 bg-[#94F27F]"
        onPress={onOk}
      >
        <Text className="text-base font-bold text-black">Ok</Text>
      </Button>
    </>
  );
}

// Loading View
function LoadingView({ isScreenMedium }: { isScreenMedium: boolean }) {
  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#94F27F" />
        <Text className="mt-4 text-white/70">Loading...</Text>
      </View>
    </View>
  );
}

// Error View
function ErrorView({ isScreenMedium, onBack }: { isScreenMedium: boolean; onBack: () => void }) {
  return (
    <View className="flex-1 bg-background">
      {isScreenMedium && <Navbar />}
      <View className="w-full max-w-lg mx-auto pt-8 px-4">
        <View className="flex-row items-center justify-between mb-8">
          <Pressable onPress={onBack} className="web:hover:opacity-70">
            <ArrowLeft color="white" />
          </Pressable>
          <Text className="text-white text-xl md:text-2xl font-semibold text-center">
            Solid card
          </Text>
          <View className="w-10" />
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-white text-lg text-center mb-4">
            Unable to detect your location
          </Text>
          <Text className="text-white/60 text-center mb-8">
            Please check your internet connection and try again.
          </Text>
          <Button
            className="rounded-xl h-12 w-full bg-[#94F27F]"
            onPress={onBack}
          >
            <Text className="text-base font-bold text-black">Go Back</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

