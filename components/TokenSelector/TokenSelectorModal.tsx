import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#404040] h-12 gap-1 rounded-full text-white">
          <Image
            source={TOKEN_IMAGES[selectedToken.imageId]}
            alt={selectedToken.symbol}
            style={{ width: 32, height: 32 }}
          />
          <Text className="text-lg font-bold text-white">{selectedToken.symbol}</Text>
          <ChevronDown />
        </Button>
      </DialogTrigger>
      <DialogContent className="md:gap-8 md:max-w-sm">
        <View className="gap-2 md:gap-4">
          <DialogTitle>Select token</DialogTitle>
          <TokenSelector
            tokens={TOKEN_MAP[1]}
            setSelectedToken={setSelectedToken}
            setOpen={setOpen}
          />
        </View>
        <View className="gap-2 md:gap-4">
          <DialogTitle>Deposit {selectedToken.symbol} on Ethereum</DialogTitle>
          <TokenSelectorDeposit />
        </View>
        <TokenSelectorFooter selectedToken={selectedToken} />
      </DialogContent>
    </Dialog>
  );
};

export default TokenSelectorModal;
