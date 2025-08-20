import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BridgeTransferCryptoCurrency, CRYPTO_LABEL } from './enums';

type CryptoDropdownProps = {
  value: BridgeTransferCryptoCurrency;
  allowed: BridgeTransferCryptoCurrency[];
  onChange: (v: BridgeTransferCryptoCurrency) => void;
};

export default function CryptoDropdown({ value, allowed, onChange }: CryptoDropdownProps) {
  const [open, setOpen] = useState(false);

  const items = useMemo(() => allowed, [allowed]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-[#404040] h-12 px-4 rounded-full text-white"
          onPress={() => setOpen(true)}
        >
          <View className="flex-row items-center gap-2">
            {/* TODO: Uncomment below when crypto icons are ready */}
            {/* {(() => {
              const Icon = getCryptoIcon(value);
              return Icon ? <Icon width={21} height={21} /> : null;
            })()} */}
            <Text className="native:text-lg native:leading-[20px] text-lg ml-1 font-bold text-white">
              {CRYPTO_LABEL[value]}
            </Text>
            <ChevronDown className="text-white" />
          </View>
        </Button>
      </DialogTrigger>
      <DialogContent className="md:max-w-sm">
        <DialogTitle>Select token</DialogTitle>
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
                {/* TODO: Uncomment below when crypto icons are ready */}
                {/* {(() => {
                  const Icon = getCryptoIcon(item);
                  return Icon ? <Icon width={21} height={21} /> : null;
                })()} */}
                <Text className="text-base font-semibold">{CRYPTO_LABEL[item]}</Text>
              </View>
            </Button>
          ))}
        </View>
      </DialogContent>
    </Dialog>
  );
}
