import { ArrowUpRight, EllipsisVertical, X } from 'lucide-react-native';
import { Linking } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

interface TransactionCredenzaTriggerProps {
  onPress?: () => void;
}

const TransactionCredenzaTrigger = ({ onPress }: TransactionCredenzaTriggerProps) => {
  return (
    <Button variant="ghost" size="icon" className="w-6 opacity-60" onPress={onPress}>
      <EllipsisVertical color="white" />
    </Button>
  );
};

const TransactionCredenzaContent = () => {
  return (
    <>
      <ArrowUpRight color="white" />
      <Text>View transaction</Text>
    </>
  );
};

const TransactionCancelContent = () => {
  return (
    <>
      <X color="white" />
      <Text>Cancel Withdraw</Text>
    </>
  );
};

const pressTransactionCredenzaContent = (url?: string) => {
  if (url) return Linking.openURL(url);
};

export {
  pressTransactionCredenzaContent,
  TransactionCancelContent,
  TransactionCredenzaContent,
  TransactionCredenzaTrigger,
};
