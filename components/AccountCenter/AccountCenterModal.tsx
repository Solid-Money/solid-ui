import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { AccountCenter, AccountCenterFooter, AccountCenterTitle, AccountCenterTrigger } from '.';

const AccountCenterModal = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <AccountCenterTrigger onModalOpen={() => setOpen(true)} />
      <DialogContent className="md:gap-8 md:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            <AccountCenterTitle />
          </DialogTitle>
        </DialogHeader>
        <AccountCenter />
        <DialogFooter>
          <AccountCenterFooter />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountCenterModal;
