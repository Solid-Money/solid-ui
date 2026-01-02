import { Plus } from 'lucide-react-native';
import { View } from 'react-native';

import ResponsiveDialog from '@/components/ResponsiveDialog';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TOKEN_MAP } from '@/constants/tokens';
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
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      title="Deposit address"
      contentClassName="md:gap-8 md:max-w-sm"
      trigger={
        <View className={buttonVariants({ variant: 'brand', className: 'h-12 rounded-xl' })}>
          <View className="flex-row items-center gap-2">
            <Plus color="black" />
            <Text className="hidden font-bold text-primary-foreground md:block">Add funds</Text>
          </View>
        </View>
      }
    >
      <View className="gap-2 md:gap-4">
        <TokenSelectorDeposit />
      </View>
      <TokenSelectorFooter selectedToken={TOKEN_MAP[1][0]} />
    </ResponsiveDialog>
  );
};

export default DepositAddressModal;
