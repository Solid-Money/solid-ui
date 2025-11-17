import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const GetCardButton = () => {
  const router = useRouter();

  const handleGetCard = async () => {
    router.push(path.CARD_ACTIVATE);
  }

  return (
    <Button
      variant="brand"
      className="rounded-xl h-12 px-8"
      onPress={handleGetCard}
    >
      <Text className="text-base font-bold">Get your card</Text>
    </Button>
  );
};

export default GetCardButton;
