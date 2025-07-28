import { Linking } from "react-native";
import { ArrowUpRight, EllipsisVertical } from "lucide-react-native";

import { Text } from "../ui/text";
import { Button } from "../ui/button";

interface TransactionCredenzaTriggerProps {
  onPress?: () => void;
}

const TransactionCredenzaTrigger = ({ onPress }: TransactionCredenzaTriggerProps) => {
  return (
    <Button
      variant='ghost'
      size='icon'
      className='w-6 opacity-60'
      onPress={onPress}
    >
      <EllipsisVertical color='white' />
    </Button>
  );
};

const TransactionCredenzaContent = () => {
  return (
    <>
      <ArrowUpRight color='white' />
      <Text>View transaction</Text>
    </>
  );
};

const pressTransactionCredenzaContent = (url?: string) => {
  if (url) return Linking.openURL(url);
}

export {
  TransactionCredenzaTrigger,
  TransactionCredenzaContent,
  pressTransactionCredenzaContent,
}
