import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const ReserveCardButton = () => {
  const router = useRouter();

  return (
    <Button
      variant="brand"
      className="rounded-xl h-12 px-8"
      onPress={() => router.push(path.CARD_WAITLIST_SUCCESS)}
    >
      <Text className="text-base font-bold">Reserve your card</Text>
    </Button>
  );
};

export default ReserveCardButton;
