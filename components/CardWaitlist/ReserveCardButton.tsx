import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { NotificationEmailModalDialog } from '@/components/NotificationEmailModal/NotificationEmailModalDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { addToCardWaitlist, checkCardAccess, getClientIp, getCountryFromIp } from '@/lib/api';
import { withRefreshToken } from '@/lib/utils';
import { useCountryStore } from '@/store/useCountryStore';

export type DetectedCountryInfo = {
  countryCode: string;
  countryName: string;
};

const ReserveCardButton = () => {
  const router = useRouter();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [detectedCountryInfo, setDetectedCountryInfo] = useState<DetectedCountryInfo | null>(null);

  const { setCountryInfo, getIpDetectedCountry, setIpDetectedCountry, getCachedIp, setCachedIp } =
    useCountryStore();

  const handleAddToWaitlist = async (countryCode: string) => {
    if (user?.email) {
      try {
        await withRefreshToken(() => addToCardWaitlist(user.email!, countryCode.toUpperCase()));
        router.push(path.CARD_WAITLIST_SUCCESS);
      } catch (error) {
        console.error('Error adding to card waitlist:', error);
      }
    }
  };

  const handleReserveCard = async () => {
    setLoading(true);

    try {
      // First, check if we have a cached IP address
      let ip = getCachedIp();

      // If no cached IP or cache expired, fetch a new one
      if (!ip) {
        ip = await getClientIp();

        if (ip) {
          setCachedIp(ip);
        } else {
          // If we can't get IP, go to country selection
          router.push(path.CARD_COUNTRY_SELECTION);
          return;
        }
      }

      // Check if we have a valid cached country info for this IP
      const cachedInfo = getIpDetectedCountry(ip);

      if (cachedInfo) {
        // Update countryInfo to match the IP-detected country
        setCountryInfo(cachedInfo);

        // If country is available, check email and add to waitlist
        if (cachedInfo.isAvailable) {
          if (user && !user.email) {
            setDetectedCountryInfo({
              countryCode: cachedInfo.countryCode,
              countryName: cachedInfo.countryName,
            });

            setShowEmailModal(true);
          } else {
            await handleAddToWaitlist(cachedInfo.countryCode);
          }
        } else {
          router.push(path.CARD_COUNTRY_SELECTION);
        }

        return;
      }

      // Fetch new country info if cache is invalid or missing
      const countryData = await getCountryFromIp();

      if (!countryData) {
        // If we can't detect country, go to country selection
        router.push(path.CARD_COUNTRY_SELECTION);
        return;
      }

      const { countryCode, countryName } = countryData;

      // Check card access via backend
      const accessCheck = await withRefreshToken(() => checkCardAccess(countryCode));

      if (!accessCheck) {
        // If check fails, go to country selection
        router.push(path.CARD_COUNTRY_SELECTION);
        return;
      }

      const countryInfo = {
        countryCode,
        countryName,
        isAvailable: accessCheck.hasAccess,
      };

      // Cache the country info
      setIpDetectedCountry(ip, countryInfo);

      // Navigate based on availability
      if (accessCheck.hasAccess) {
        // If country is available, check email and add to waitlist
        if (user && !user.email) {
          setDetectedCountryInfo({ countryCode, countryName });
          setShowEmailModal(true);
        } else {
          await handleAddToWaitlist(countryCode);
        }
      } else {
        router.push(path.CARD_COUNTRY_SELECTION);
      }
    } catch (error) {
      console.error('Error checking country availability:', error);
      // On error, go to country selection as fallback
      router.push(path.CARD_COUNTRY_SELECTION);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NotificationEmailModalDialog
        open={showEmailModal}
        onOpenChange={open => {
          setShowEmailModal(open);
        }}
        onSuccess={async () => {
          setShowEmailModal(false);

          // Add user to waitlist
          if (detectedCountryInfo) {
            await handleAddToWaitlist(detectedCountryInfo.countryCode);
          }
        }}
      />
      <Button
        variant="brand"
        className="rounded-xl h-12 px-8"
        onPress={handleReserveCard}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text className="text-base font-bold">Reserve your card</Text>
        )}
      </Button>
    </>
  );
};

export default ReserveCardButton;
