import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AccountCenter, AccountCenterFooter, AccountCenterTitle, AccountCenterTrigger } from '.';

const AccountCenterModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <AccountCenterTrigger />
      </DialogTrigger>
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
