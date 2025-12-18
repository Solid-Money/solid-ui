import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BridgeTransferFiatCurrency, FIAT_LABEL } from './enums';
import { getFiatIcon } from './icons';

type FiatDropdownProps = {
  value: BridgeTransferFiatCurrency;
  onChange: (v: BridgeTransferFiatCurrency) => void;
};

export default function FiatDropdown({ value, onChange }: FiatDropdownProps) {
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => [
      BridgeTransferFiatCurrency.USD,
      BridgeTransferFiatCurrency.EUR,
      BridgeTransferFiatCurrency.MXN,
      BridgeTransferFiatCurrency.BRL,
    ],
    [],
  );

  const renderFlag = (code: BridgeTransferFiatCurrency) => {
    const Icon = getFiatIcon(code);
    return Icon ? <Icon width={21} height={22} /> : null;
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Select currency"
      contentClassName="md:max-w-sm"
      trigger={
        <Button
          className="bg-[#4D4D4D] h-12 px-4 rounded-full text-white"
          onPress={() => setOpen(true)}
        >
          <View className="flex-row items-center gap-2">
            {renderFlag(value)}
            <Text className="native:text-lg native:leading-[20px] text-lg ml-1 font-bold text-white">
              {FIAT_LABEL[value]}
            </Text>
            <ChevronDown className="text-white" />
          </View>
        </Button>
      }
    >
      <View className="gap-2">
        {items.map(item => (
          <Button
            key={item}
            variant={item === value ? 'secondary' : 'ghost'}
            className="h-12 rounded-xl justify-start"
            onPress={() => {
              onChange(item);
              setOpen(false);
            }}
          >
            <View className="flex-row items-center gap-2">
              {renderFlag(item)}
              <Text className="text-base font-semibold">{FIAT_LABEL[item]}</Text>
            </View>
          </Button>
        ))}
      </View>
    </ResponsiveDialog>
  );
}
