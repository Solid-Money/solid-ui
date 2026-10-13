import { Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Text } from '@/components/ui/text';
import { Country } from '@/constants/countries';

/**
 * The list has one step, so the modal's forward/back animation has nothing to
 * animate between. These exist only to satisfy ResponsiveModal's step API.
 */
const LIST_MODAL = { name: 'country_list', number: 1 };
const LIST_MODAL_CLOSED = { name: 'close', number: 0 };

export interface CountryDropdownProps {
  visible: boolean;
  searchQuery: string;
  filteredCountries: Country[];
  onClose: () => void;
  onSearchChange: (text: string) => void;
  onCountrySelect: (country: Country) => void;
  /**
   * Opened from inside a dialog rather than from a screen.
   *
   * On web an open dialog owns pointer events, scrolling and focus for
   * everything outside itself, and a React Native `Modal` portals to the end of
   * `<body>` — outside it. The list showed, but could not be tapped, scrolled or
   * typed into. It is presented as a dialog of its own instead, which the open
   * one hands control to, the same way the setup-fee sheet sits over the
   * virtual-account pitch. Native dialogs are plain views, so a `Modal` already
   * sits above them there and is kept.
   */
  inDialog?: boolean;
}

type CountryListProps = Pick<
  CountryDropdownProps,
  'searchQuery' | 'filteredCountries' | 'onSearchChange' | 'onCountrySelect'
>;

const CountryList = ({
  searchQuery,
  filteredCountries,
  onSearchChange,
  onCountrySelect,
}: CountryListProps) => (
  <>
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
  </>
);

/** Searchable country list, opened from {@link CountrySelector}. */
export function CountryDropdown({
  visible,
  searchQuery,
  filteredCountries,
  onClose,
  onSearchChange,
  onCountrySelect,
  inDialog = false,
}: CountryDropdownProps) {
  const list = (
    <CountryList
      searchQuery={searchQuery}
      filteredCountries={filteredCountries}
      onSearchChange={onSearchChange}
      onCountrySelect={onCountrySelect}
    />
  );

  if (inDialog && Platform.OS === 'web') {
    return (
      <ResponsiveModal
        currentModal={LIST_MODAL}
        previousModal={LIST_MODAL_CLOSED}
        isOpen={visible}
        onOpenChange={open => {
          // The scrim and the Escape key both arrive here.
          if (!open) onClose();
        }}
        trigger={null}
        contentKey="country-list"
        shouldAnimate={false}
        hideHeader
        mobilePresentation="drawer"
        contentClassName="bg-[#333331] md:max-w-md"
      >
        {list}
      </ResponsiveModal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <Pressable
          className="w-[90%] max-w-md rounded-2xl bg-[#333331]"
          onPress={e => e.stopPropagation()}
        >
          <View className="p-4">{list}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default CountryDropdown;
