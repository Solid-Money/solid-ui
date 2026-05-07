import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

interface GetCardButtonProps {
  className?: string;
  onPress?: () => void;
}

const GetCardButton = ({ className, onPress }: GetCardButtonProps) => {
  const router = useRouter();

  const handleGetCard = async () => {
    onPress?.();
    track(TRACKING_EVENTS.CARD_GET_CARD_PRESSED, {
      source: 'card_waitlist',
    });

    router.push(path.CARD_ACTIVATE);
  };

  return (
    <Button variant="brand" className={cn('h-12 rounded-xl px-8', className)} onPress={handleGetCard}>
      <Text className="text-base font-bold">Get your card</Text>
    </Button>
  );
};

export default GetCardButton;
