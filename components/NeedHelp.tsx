import { Button } from './ui/button';
import { useIntercom } from '@/lib/intercom';
import { Text } from './ui/text';
import MessageCircle from '@/assets/images/messages';

const NeedHelp = () => {
  const intercom = useIntercom();

  return (
    <Button
      variant="ghost"
      className="flex-row items-center gap-2 rounded-xl"
      onPress={() => intercom?.show()}
    >
      <MessageCircle color="#ffffffb3" />
      <Text className="text-base opacity-70 font-medium">Need help?</Text>
    </Button>
  );
};

export default NeedHelp;
