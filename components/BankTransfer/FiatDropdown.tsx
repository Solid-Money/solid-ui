import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BridgeTransferFiatCurrency, FIAT_LABEL } from './enums';

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
    ],
    [],
  );

  // const renderFlag = (code: BridgeTransferFiatCurrency) => {
  //   const Icon = getFiatIcon(code);
  //   return Icon ? <Icon width={21} height={22} /> : null;
  // };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-[#4D4D4D] h-12 px-4 rounded-full text-white"
          onPress={() => setOpen(true)}
        >
          <View className="flex-row items-center gap-2">
            {/* TODO: Uncomment below when flag icons are ready */}
            {/* {renderFlag(value)} */}
            <Text className="native:text-lg native:leading-[20px] text-lg ml-1 font-bold text-white">
              {FIAT_LABEL[value]}
            </Text>
            <ChevronDown className="text-white" />
          </View>
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogTitle>Select currency</DialogTitle>
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
                {/* TODO: Uncomment below when flag icons are ready */}
                {/* {renderFlag(item)} */}
                <Text className="text-base font-semibold">{FIAT_LABEL[item]}</Text>
              </View>
            </Button>
          ))}
        </View>
      </DialogContent>
    </Dialog>
  );
}
