import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

const ReserveCardButton = () => {
  return (
    <Button variant="brand" className="rounded-xl h-12 px-8">
      <Text className="text-base font-bold">Reserve your card</Text>
    </Button>
  );
};

export default ReserveCardButton;
