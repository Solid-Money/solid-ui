import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { CountryDropdown, CountrySelector, filterCountries } from '@/components/CountryPicker';
import { COUNTRIES, Country } from '@/constants/countries';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { detectGeo } from '@/lib/geo';
import { useCountryStore } from '@/store/useCountryStore';

export interface WirexResidenceStepProps {
  onConfirm: (country: Country) => void;
  isConfirming: boolean;
}

/**
 * "Where do you live?" — asked before Sumsub for a user with no residence on
 * file.
 *
 * Wirex issues an IBAN by country of residence, and the verification it runs
 * checks a proof of address against it, so the answer has to come from the user:
 * the server refuses to start the session on an IP guess. What the app already
 * knows only preselects the field.
 */
export const WirexResidenceStep = ({ onConfirm, isConfirming }: WirexResidenceStepProps) => {
  const [country, setCountry] = useState<Country | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Set once the user picks by hand, so a late lookup cannot overwrite it.
  const pickedByHand = useRef(false);
  const filteredCountries = useMemo(() => filterCountries(search), [search]);

  useEffect(() => {
    let cancelled = false;
    const preselect = async () => {
      const known = useCountryStore.getState().countryInfo?.countryCode;
      const code = known ?? (await detectGeo())?.countryCode;
      const detected = code ? COUNTRIES.find(c => c.code === code.toUpperCase()) : undefined;

      track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_RESIDENCE_VIEWED, {
        provider: 'wirex',
        detected_country_code: detected?.code ?? null,
      });

      if (cancelled || !detected || pickedByHand.current) return;
      setCountry(current => current ?? detected);
    };
    void preselect();

    return () => {
      cancelled = true;
    };
  }, []);

  const openDropdown = useCallback(() => {
    setSearch('');
    setIsDropdownOpen(true);
  }, []);

  const selectCountry = useCallback((selected: Country) => {
    pickedByHand.current = true;
    setCountry(selected);
    setSearch(selected.name);
    setIsDropdownOpen(false);
  }, []);

  const confirm = useCallback(() => {
    if (!country) return;
    track(TRACKING_EVENTS.VIRTUAL_ACCOUNT_RESIDENCE_CONFIRMED, {
      provider: 'wirex',
      country_code: country.code,
      picked_by_hand: pickedByHand.current,
    });
    onConfirm(country);
  }, [country, onConfirm]);

  return (
    <View className="flex-1 px-6 pt-8">
      <CountrySelector
        selectedCountry={country}
        onOpenDropdown={openDropdown}
        onOk={confirm}
        processing={isConfirming}
        title="Where do you live?"
        description="Bank accounts are opened in your country of residence. You'll confirm it with a proof of address when you verify."
        confirmLabel="Continue"
      />
      <CountryDropdown
        visible={isDropdownOpen}
        searchQuery={search}
        filteredCountries={filteredCountries}
        onClose={() => setIsDropdownOpen(false)}
        onSearchChange={setSearch}
        onCountrySelect={selectCountry}
        inDialog
      />
    </View>
  );
};
