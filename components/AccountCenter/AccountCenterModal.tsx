import ResponsiveDialog from '@/components/ResponsiveDialog';
import { useState } from 'react';
import { View } from 'react-native';
import { AccountCenter, AccountCenterFooter, AccountCenterTitle, AccountCenterTrigger } from '.';

const AccountCenterModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={setOpen}
      contentClassName="md:gap-8 md:max-w-sm"
      trigger={<AccountCenterTrigger onModalOpen={() => setOpen(true)} />}
    >
      <View className="gap-6">
        <AccountCenterTitle />
        <AccountCenter />
        <AccountCenterFooter />
      </View>
    </ResponsiveDialog>
  );
};

export default AccountCenterModal;
