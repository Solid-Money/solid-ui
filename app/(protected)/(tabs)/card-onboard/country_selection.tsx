import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';

import { TickIcon } from '@/components/Card/MainCurrency/icons';
import { WirexOnboardingLayout } from '@/components/Card/WirexOnboarding/WirexOnboardingLayout';
import CountryFlagImage from '@/components/CountryFlagImage';
import { CountryDropdown, CountrySelector, filterCountries } from '@/components/CountryPicker';
import PageLayout from '@/components/PageLayout';
import { RegionUnavailableView } from '@/components/RegionUnavailable';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { COUNTRIES, Country } from '@/constants/countries';
import { path, WIREX_ONBOARDING_FLOW } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { useCardStatus } from '@/hooks/useCardStatus';
import { PROSPECTIVE_CARD_ISSUER_QUERY_KEY } from '@/hooks/useProspectiveCardIssuer';
import { track } from '@/lib/analytics';
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
  const queryClient = useQueryClient();
  // `?flow=wirex`: this screen is step 1 of the Wirex card onboarding and wears its stepper.
  // Every other entry point keeps today's screen.
  const { flow } = useLocalSearchParams<{ flow?: string }>();
  const isWirexFlow = flow === WIREX_ONBOARDING_FLOW;

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

  // Wirex step 1 says whether the card is offered in the picked country before Continue, so the
  // answer is not a surprise one tap later. Checked once per country and kept, which also lets
  // Continue reuse it. `null` is a check that failed: say nothing rather than guess.
  const [availability, setAvailability] = useState<Record<string, boolean | null>>({});
  const selectedCode = selectedCountry?.code;
  useEffect(() => {
    if (!isWirexFlow || !selectedCode || availability[selectedCode] !== undefined) return;

    let cancelled = false;
    checkProductAccess('card', selectedCode)
      .then(hasAccess => {
        // checkProductAccess resolves null for a failed/indeterminate check: keep
        // it null (not false) so the country is not pinned as a definitive "no"
        // and handleCountrySelectorOk can retry the lookup.
        if (!cancelled)
          setAvailability(prev => ({
            ...prev,
            [selectedCode]: typeof hasAccess === 'boolean' ? hasAccess : null,
          }));
      })
      .catch(() => {
        if (!cancelled) setAvailability(prev => ({ ...prev, [selectedCode]: null }));
      });

    return () => {
      cancelled = true;
    };
  }, [isWirexFlow, selectedCode, availability]);

  const handleCountrySelectorOk = async () => {
    if (!selectedCountry) return;

    setProcessing(true);
    try {
      const hasAccess =
        availability[selectedCountry.code] ??
        (await checkProductAccess('card', selectedCountry.code));

      setCountryInfo({
        countryCode: selectedCountry.code,
        countryName: selectedCountry.name,
        // A failed check is not a yes: fall through to the unavailable pop-up
        // rather than sending the user into a flow the issuer will reject.
        isAvailable: hasAccess === true,
        source: 'manual',
      });

      // Which issuer serves the user follows from this country, and the activation screen reads
      // that answer from a cache keyed only by user: drop it so the next screen asks again.
      void queryClient.invalidateQueries({ queryKey: [PROSPECTIVE_CARD_ISSUER_QUERY_KEY] });

      if (isWirexFlow) {
        track(TRACKING_EVENTS.CARD_ONBOARDING_CTA_PRESSED, {
          step: 'country',
          countryCode: selectedCountry.code,
          available: hasAccess === true,
        });
      }

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

  const countryDropdown = (
    <CountryDropdown
      visible={showDropdown}
      searchQuery={searchQuery}
      filteredCountries={filteredCountries}
      onClose={() => setShowDropdown(false)}
      onSearchChange={setSearchQuery}
      onCountrySelect={handleCountrySelect}
    />
  );

  // Step 1 of the Wirex onboarding (Figma 1 · Country): country only — no currency question
  // before KYC — and whether the card is offered there, said under the field.
  if (isWirexFlow) {
    const isAvailable = selectedCode ? availability[selectedCode] : undefined;

    return (
      <WirexOnboardingLayout
        step={1}
        onBack={goBack}
        footer={
          <Button
            variant="brand"
            className="w-full"
            onPress={handleCountrySelectorOk}
            disabled={!selectedCountry || processing}
          >
            {processing ? <ActivityIndicator color="#000000" /> : <Text>Continue</Text>}
          </Button>
        }
      >
        <View className="gap-6">
          <View className="items-center gap-1.5">
            <Text className="text-center text-2xl font-semibold text-white">
              Where do you live?
            </Text>
            <Text className="text-center text-sm text-[#ACACAC]">
              We’ll check the Solid card is available there.
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-sm font-medium text-[#ACACAC]">Country of residence</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Country of residence"
              onPress={handleOpenDropdown}
              className="h-14 flex-row items-center gap-3 rounded-2xl bg-[#1C1C1C] px-4"
            >
              {selectedCountry ? (
                <CountryFlagImage
                  isoCode={selectedCountry.code}
                  size={28}
                  countryName={selectedCountry.name}
                />
              ) : null}
              <Text className="flex-1 text-base text-white">
                {selectedCountry ? selectedCountry.name : 'Select country'}
              </Text>
              <ChevronDown color="white" size={20} />
            </Pressable>

            {selectedCountry && isAvailable === true ? (
              <View className="flex-row items-center gap-2">
                <TickIcon size={16} />
                <Text className="text-[13px] text-[#ACACAC]">
                  The Solid card is available in {selectedCountry.name}
                </Text>
              </View>
            ) : null}
            {selectedCountry && isAvailable === false ? (
              <Text className="text-[13px] text-[#ACACAC]">
                The Solid card isn’t available in {selectedCountry.name} yet
              </Text>
            ) : null}
          </View>
        </View>
        {countryDropdown}
      </WirexOnboardingLayout>
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
        {countryDropdown}
      </View>
    </PageLayout>
  );
}
