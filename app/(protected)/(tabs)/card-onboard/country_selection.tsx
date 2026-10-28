import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';

import { CountryDropdown, CountrySelector, filterCountries } from '@/components/CountryPicker';
import PageLayout from '@/components/PageLayout';
import { RegionUnavailableView } from '@/components/RegionUnavailable';
import { BackButton } from '@/components/ui/back-button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path } from '@/constants/path';
import { useCardStatus } from '@/hooks/useCardStatus';
import { checkProductAccess, resolveCountryAccess } from '@/lib/countryAccess';
import {
  canReplaceClosedCard,
  hasCard,
  hasCardStatusWithRainApplication,
  hasPendingCard,
} from '@/lib/utils';
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
  // lookup took. Detection swaps in the pop-up if the card isn't issued where
  // the user is, and otherwise just preselects their country.
  const [showCountrySelector, setShowCountrySelector] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [processing, setProcessing] = useState(false);
  // Set as soon as the user touches the selector. Detection lands
  // asynchronously, and yanking someone out of a country they're part-way
  // through picking would be worse than not showing the pop-up at all.
  const interacted = useRef(false);

  // `isLoading`, not `isPending`: a disabled query (no selected user yet) stays
  // pending forever, which would stall detection instead of merely delaying it.
  const { data: cardStatus, isLoading: cardStatusLoading } = useCardStatus();
  // Same escape hatch as `useActivateCard`: someone holding a card, waiting on one
  // being issued, or part-way through a Rain application cleared the gate once.
  // Their IP saying otherwise (travel, VPN) must not present them with a "no card
  // in your region" wall.
  const clearedGate =
    hasCard(cardStatus) ||
    hasPendingCard(cardStatus) ||
    canReplaceClosedCard(cardStatus) ||
    hasCardStatusWithRainApplication(cardStatus);

  const { countryInfo, setCountryInfo } = useCountryStore(
    useShallow(state => ({
      countryInfo: state.countryInfo,
      setCountryInfo: state.setCountryInfo,
    })),
  );

  // Where is the user, and is the card issued there? Answering by IP is the
  // default so an unserved user reaches the pop-up without having to name their
  // own country first — the same way the virtual account flow works. Picking by
  // hand stays one tap away behind "Change country", because an IP is only a
  // guess at residence and travellers will be guessed wrong.
  //
  // Never blocks the screen: the selector is already on screen, and a failed
  // lookup simply leaves it there with an empty field.
  useEffect(() => {
    // Wait for card status, or a card holder abroad would see the pop-up flash
    // up before `clearedGate` resolves.
    if (cardStatusLoading) return;

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

        if (!access.isAvailable && !interacted.current && !clearedGate) {
          setShowCountrySelector(false);
        }
      } catch (error) {
        console.error('Error detecting country:', error);
      }
    };

    void detect();

    return () => {
      cancelled = true;
    };
  }, [cardStatusLoading, clearedGate]);

  const filteredCountries = useMemo(() => filterCountries(searchQuery), [searchQuery]);

  // "Change country" on the pop-up — the traveller's way back to picking by
  // hand. Marks the screen as interacted so a late lookup can't bounce them
  // straight back out to the pop-up.
  const handleChangeCountry = () => {
    interacted.current = true;
    setShowCountrySelector(true);
  };

  const handleOpenDropdown = () => {
    interacted.current = true;
    setSearchQuery('');
    setShowDropdown(true);
  };

  const handleCountrySelect = (country: Country) => {
    interacted.current = true;
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
