import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';

const CardWaitlistBackButton = () => {
  const router = useRouter();

  return (
    <Button variant="brand" className="rounded-xl h-12 px-8" onPress={() => router.push(path.HOME)}>
      <Text className="text-base font-bold">Back to home</Text>
    </Button>
  );
};

export default CardWaitlistBackButton;
