import MessageCircle from '@/assets/images/messages';
import { openIntercom } from '@/lib/intercom';

import { Button } from './ui/button';
import { Text } from './ui/text';

const NeedHelp = () => {
  return (
    <Button
      variant="ghost"
      className="flex-row items-center gap-2 overflow-visible rounded-xl"
      onPress={openIntercom}
    >
      <MessageCircle color="#ffffffb3" />
      <Text className="text-base font-medium opacity-70">Need help?</Text>
    </Button>
  );
};

export default NeedHelp;
