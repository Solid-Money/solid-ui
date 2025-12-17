import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { NotificationEmailModalDialog } from '@/components/NotificationEmailModal/NotificationEmailModalDialog';

import CountryFlagImage from '@/components/CountryFlagImage';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import {
  addToCardWaitlist,
  addToCardWaitlistToNotify,
  checkCardAccess,
  checkCardWaitlistToNotifyStatus,
  getClientIp,
  getCountryFromIp,
} from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export default function CountrySelection() {
  const router = useRouter();
  const { user } = useUser();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push(path.CARD);
    }
  };

  const [loading, setLoading] = useState(true);
  const [notifyClicked, setNotifyClicked] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [confirmedAvailableCountry, setConfirmedAvailableCountry] = useState(false);
  const [processingWaitlist, setProcessingWaitlist] = useState(false);
  const [isInNotifyWaitlist, setIsInNotifyWaitlist] = useState(false);
  const [checkingWaitlist, setCheckingWaitlist] = useState(false);

  const { countryInfo, setCountryInfo, setCountryDetectionFailed } = useCountryStore();

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
          }
          // If the cached country is unavailable, show the unavailable view directly
          setShowCountrySelector(cachedInfo.isAvailable);
          setLoading(false);
          return;
        }

        // If country detection already failed (e.g., from ReserveCardButton),
        // skip retry and go straight to manual selection.
        if (store.countryDetectionFailed) {
          setShowCountrySelector(true);
          setLoading(false);
          return;
        }

        // Fetch new country info if cache is invalid or missing
        const countryInfo = await getCountryFromIpAndCheckAccess();

        if (countryInfo) {
          store.setIpDetectedCountry(ip, countryInfo);
          // Clear failure flag on successful detection
          store.setCountryDetectionFailed(false);

          const country = COUNTRIES.find(c => c.code === countryInfo.countryCode);

          if (country) {
            setSelectedCountry(country);
            setSearchQuery(country.name);
          }
          // Skip selector when the detected country is unavailable so we show the "not ready" state
          setShowCountrySelector(countryInfo.isAvailable);
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

  // Check if user is already in notify waitlist
  useEffect(() => {
    const checkNotifyWaitlistStatus = async () => {
      // Only check if country is loaded and unavailable
      if (!countryInfo) {
        return;
      }

      if (user?.email && !countryInfo.isAvailable) {
        setCheckingWaitlist(true);
        try {
          const response = await checkCardWaitlistToNotifyStatus(user.email);
          setIsInNotifyWaitlist(response.isInWaitlist);

          if (response.isInWaitlist) {
            setNotifyClicked(true);
            setShowCountrySelector(false);
          }
        } catch (error) {
          console.error('Error checking notify waitlist status:', error);
          setIsInNotifyWaitlist(false);
        } finally {
          setCheckingWaitlist(false);
        }
      } else {
        setCheckingWaitlist(false);
      }
    };

    checkNotifyWaitlistStatus();
  }, [user?.email, countryInfo]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return COUNTRIES;
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const handleNotifyByMail = async () => {
    // Check if user has email
    if (user && !user.email) {
      setShowEmailModal(true);
    } else {
      // User already has email, add to notify waitlist directly
      if (user?.email && countryInfo?.countryCode) {
        try {
          await withRefreshToken(() =>
            addToCardWaitlistToNotify(user.email!, countryInfo.countryCode.toUpperCase()),
          );
        } catch (error) {
          console.error('Error adding to card waitlist to notify:', error);
        }
      }
      setNotifyClicked(true);
    }
  };

  const handleChangeCountry = () => {
    setShowCountrySelector(true);
    setConfirmedAvailableCountry(false);
  };

  const handleOpenDropdown = () => {
    setSearchQuery('');
    setShowDropdown(true);
    setConfirmedAvailableCountry(false);
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setSearchQuery(country.name);
    setShowDropdown(false);
  };

  const handleCountrySelectorOk = async () => {
    if (selectedCountry) {
      setProcessingWaitlist(true);
      try {
        // Check card access via backend API
        const accessCheck = await withRefreshToken(() => checkCardAccess(selectedCountry.code));

        if (!accessCheck) throw new Error('Failed to check card access');

        // Create the updated country info
        const updatedCountryInfo = {
          countryCode: selectedCountry.code,
          countryName: selectedCountry.name,
          isAvailable: accessCheck.hasAccess,
          source: 'manual' as const,
        };

        // Update store and clear failure flag
        setCountryInfo(updatedCountryInfo);
        setCountryDetectionFailed(false);

        // If selected country is available, navigate to card activation
        // Pass countryConfirmed param to skip the country check on activate page
        if (accessCheck.hasAccess) {
          router.push({
            pathname: path.CARD_ACTIVATE,
            params: { countryConfirmed: 'true' },
          });
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
          source: 'manual' as const,
        };

        setCountryInfo(unavailableCountryInfo);
        setShowCountrySelector(false);
        setNotifyClicked(false);
      } finally {
        setProcessingWaitlist(false);
      }
    }
  };

  if (loading || checkingWaitlist) {
    return <LoadingView />;
  }

  return (
    <PageLayout desktopOnly>
      {/* Email collection modal */}
      <NotificationEmailModalDialog
        open={showEmailModal}
        onOpenChange={open => {
          setShowEmailModal(open);
        }}
        onSuccess={async () => {
          setShowEmailModal(false);
          // Add user to waitlist or notify list based on country availability
          if (user?.email && selectedCountry && countryInfo) {
            try {
              // If country is available, add to reserve waitlist
              // Otherwise, add to notify waitlist
              if (countryInfo.isAvailable) {
                await withRefreshToken(() =>
                  addToCardWaitlist(user.email!, selectedCountry.code.toUpperCase()),
                );
                setConfirmedAvailableCountry(true);
              } else {
                await withRefreshToken(() =>
                  addToCardWaitlistToNotify(user.email!, selectedCountry.code.toUpperCase()),
                );
                setNotifyClicked(true);
              }
            } catch (error) {
              console.error('Error adding to card waitlist:', error);
            }
          }
        }}
      />
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
              confirmed={confirmedAvailableCountry}
              processing={processingWaitlist}
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
        ) : notifyClicked && countryInfo ? (
          <View className="flex-1 justify-center">
            <View className="bg-[#1C1C1C] rounded-[20px] px-10 py-8 w-full items-center">
              <NotifyConfirmationView
                countryName={countryInfo.countryName}
                countryCode={countryInfo.countryCode}
              />
            </View>
          </View>
        ) : countryInfo ? (
          <View className="flex-1 justify-center">
            <View className="bg-[#1C1C1C] rounded-[20px] px-10 py-8 w-full items-center">
              <CountryUnavailableView
                countryName={countryInfo.countryName}
                countryCode={countryInfo.countryCode}
                onChangeCountry={handleChangeCountry}
                onNotifyByMail={handleNotifyByMail}
                isInNotifyWaitlist={isInNotifyWaitlist}
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
  confirmed?: boolean;
  processing?: boolean;
}

function CountrySelector({
  selectedCountry,
  onOpenDropdown,
  onOk,
  confirmed,
  processing,
}: CountrySelectorProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="bg-[#1C1C1C] rounded-xl p-8 w-full max-w-md">
        <Text className="text-white text-2xl font-semibold mb-2 text-center">
          Country of residence
        </Text>
        <Text className="text-white/60 text-sm mb-6 text-center">
          Please select your country of residence to see if the Solid card is available there
        </Text>

        {selectedCountry && (
          <View className="items-center mb-6">
            <CountryFlagImage isoCode={selectedCountry.code} size={110} className="mb-2" />
          </View>
        )}
        {!confirmed ? (
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
        ) : (
          <View className="items-center py-4">
            <Text className="text-[#94F27F] text-lg font-semibold">✓ We will notify you</Text>
          </View>
        )}
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
  isInNotifyWaitlist: boolean;
}

function CountryUnavailableView({
  countryName,
  countryCode,
  onChangeCountry,
  onNotifyByMail,
  isInNotifyWaitlist,
}: CountryUnavailableViewProps) {
  return (
    <>
      <CountryFlagImage isoCode={countryCode} size={110} className="mt-4 mb-6" />
      <Text className="text-white text-2xl font-bold mb-4 text-center">
        {`We're not ready for ${countryName} just yet!`}
      </Text>
      <Text className="text-[#ACACAC] text-center font-weight-400 mb-6 leading-6">
        {`Unfortunately, Solid card isn't available here yet. We can let you know as soon as it is.`}
      </Text>
      <Pressable onPress={onChangeCountry} className="mb-6 web:hover:opacity-70">
        <Text className="text-white font-bold text-base">Change country</Text>
      </Pressable>
      {!isInNotifyWaitlist && (
        <Button className="rounded-xl h-11 w-full mt-6 bg-[#94F27F]" onPress={onNotifyByMail}>
          <Text className="text-base font-bold text-black">Notify by mail</Text>
        </Button>
      )}
    </>
  );
}

// Notify Confirmation View
interface NotifyConfirmationViewProps {
  countryName: string;
  countryCode: string;
}

function NotifyConfirmationView({ countryName, countryCode }: NotifyConfirmationViewProps) {
  return (
    <>
      <CountryFlagImage isoCode={countryCode} size={110} className="mb-6" />
      <Text className="text-white text-2xl font-semibold mb-4 text-center">Thanks</Text>
      <Text className="text-[#ACACAC] text-center mb-8 leading-6">
        {`We'll let you know as soon as Cash cards become available in ${countryName}. Hopefully very soon!`}
      </Text>
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
