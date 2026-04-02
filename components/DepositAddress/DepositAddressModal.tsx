import { View } from 'react-native';
import { Plus } from 'lucide-react-native';

import ResponsiveDialog from '@/components/ResponsiveDialog';
import { buttonVariants } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

import QRCodeAndAddress from './QRCodeAndAddress';

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
      title="Your Solid address"
      contentClassName="md:max-w-sm"
      trigger={
        <View className={buttonVariants({ variant: 'brand', className: 'h-12 rounded-xl' })}>
          <View className="flex-row items-center gap-2">
            <Plus color="black" />
            <Text className="hidden font-bold text-primary-foreground md:block">Add funds</Text>
          </View>
        </View>
      }
    >
      <QRCodeAndAddress />
    </ResponsiveDialog>
  );
};

export default DepositAddressModal;
