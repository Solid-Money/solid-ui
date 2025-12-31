import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import ResponsiveDialog from '@/components/ResponsiveDialog';
import { Text } from '@/components/ui/text';
import { TOKEN_IMAGES, TOKEN_MAP } from '@/constants/tokens';
import { Token } from '@/lib/types';
import TokenSelector from '.';
import TokenSelectorDeposit from './TokenSelectorDeposit';
import TokenSelectorFooter from './TokenSelectorFooter';

const TokenSelectorModal = () => {
  const [open, setOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<Token>(TOKEN_MAP[1][0]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Select token"
      contentClassName="md:gap-8 md:max-w-sm"
      trigger={
        <Button className="bg-[#404040] h-12 gap-1 rounded-full text-white">
          <Image
            source={TOKEN_IMAGES[selectedToken.imageId]}
            alt={selectedToken.symbol}
            style={{ width: 32, height: 32 }}
          />
          <Text className="text-lg font-bold text-white">{selectedToken.symbol}</Text>
          <ChevronDown />
        </Button>
      }
    >
      <View className="gap-2 md:gap-4">
        <TokenSelector
          tokens={TOKEN_MAP[1]}
          setSelectedToken={setSelectedToken}
          setOpen={setOpen}
        />
      </View>
      <View className="gap-2 md:gap-4">
        <View className="text-lg font-semibold text-white">
          Deposit {selectedToken.symbol} on Ethereum
        </View>
        <TokenSelectorDeposit />
      </View>
      <TokenSelectorFooter selectedToken={selectedToken} />
    </ResponsiveDialog>
  );
};

export default TokenSelectorModal;
