import MessageCircle from '@/assets/images/messages';
import { useIntercom } from '@/lib/intercom';

import { Button } from './ui/button';
import { Text } from './ui/text';

const NeedHelp = () => {
  const intercom = useIntercom();

  return (
    <Button
      variant="ghost"
      className="flex-row items-center gap-2 overflow-visible rounded-xl"
      onPress={() => intercom?.show()}
    >
      <MessageCircle color="#ffffffb3" />
      <Text className="text-base font-medium opacity-70">Need help?</Text>
    </Button>
  );
};

export default NeedHelp;
