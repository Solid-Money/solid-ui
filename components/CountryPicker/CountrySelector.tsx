import { ActivityIndicator, Pressable, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import CountryFlagImage from '@/components/CountryFlagImage';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Country } from '@/constants/countries';

export interface CountrySelectorProps {
  selectedCountry: Country | null;
  onOpenDropdown: () => void;
  /** Confirm the selection. Only needed when {@link showConfirmButton} is on. */
  onOk?: () => void;
  processing?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  /**
   * Off where the host pins its own primary action (the deposit dialog), so the
   * screen does not end up with two confirm buttons.
   */
  showConfirmButton?: boolean;
}

/**
 * Flag, chosen country and a field that opens {@link CountryDropdown}.
 *
 * Shared by the card's residence check and the virtual account's ID-document
 * check, so both ask "which country?" with the same control.
 */
export function CountrySelector({
  selectedCountry,
  onOpenDropdown,
  onOk,
  processing,
  title = 'Country of residence',
  description = 'Please select your country of residence to see if the Solid card is available there',
  confirmLabel = 'Ok',
  showConfirmButton = true,
}: CountrySelectorProps) {
  return (
    <View className="flex-1 justify-center">
      <View className="w-full max-w-md rounded-xl bg-[#1C1C1C] p-8">
        <Text className="mb-2 text-center text-2xl font-semibold text-white">{title}</Text>
        <Text className="mb-6 text-center text-sm text-white/60">{description}</Text>

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
          <View
            className={`mt-2 h-12 flex-row items-center justify-between rounded-xl border border-[#898989] bg-[#1A1A1A] px-4 ${
              showConfirmButton ? 'mb-6' : ''
            }`}
          >
            <Text className="text-white">
              {selectedCountry ? selectedCountry.name : 'Select country'}
            </Text>
            <ChevronDown color="white" size={20} />
          </View>
        </Pressable>

        {showConfirmButton && (
          <Button
            variant="brand"
            className="mb-4 w-full"
            onPress={onOk}
            disabled={!selectedCountry || processing}
          >
            {processing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-base font-bold text-black">{confirmLabel}</Text>
            )}
          </Button>
        )}
      </View>
    </View>
  );
}

export default CountrySelector;
