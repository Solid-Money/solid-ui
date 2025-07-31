import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TOKEN_MAP } from '@/constants/tokens';
import { buttonVariants } from '../ui/button';
import TokenSelectorFooter from './Footer';
import TokenSelectorDeposit from './QRCodeAndAddress';

const DepositAddressModal = ({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <View className={buttonVariants({ variant: 'brand', className: 'h-12 rounded-xl' })}>
          <View className="flex-row items-center gap-2">
            <Plus color="black" />
            <Text className="text-primary-foreground font-bold hidden md:block">Add funds</Text>
          </View>
        </View>
      </DialogTrigger>
      <DialogContent className="md:gap-8 md:max-w-sm">
        <View className="gap-2 md:gap-4">
          <DialogTitle>Deposit address</DialogTitle>
          <TokenSelectorDeposit />
        </View>
        <TokenSelectorFooter selectedToken={TOKEN_MAP[1][0]} />
      </DialogContent>
    </Dialog>
  );
};

export default DepositAddressModal;
