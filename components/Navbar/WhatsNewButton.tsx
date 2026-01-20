import React from 'react';
import { Pressable } from 'react-native';
import { X } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useWhatsNew } from '@/hooks/useWhatsNew';

const WhatsNewButton = () => {
  const { showLatest, whatsNew, isButtonDismissed, dismissButton } = useWhatsNew();

  if (!whatsNew || isButtonDismissed) return null;

  return (
    <Pressable
      onPress={showLatest}
      className="h-9 flex-row items-center gap-1 rounded-full bg-[#2A2A2A] pl-4 pr-3 transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <Text className="text-base font-medium text-white/70">What&apos;s new?</Text>
      <Pressable
        onPress={e => {
          e.stopPropagation();
          dismissButton();
        }}
        className="rounded-full p-1 web:hover:bg-white/10"
      >
        <X size={18} color="#FFFFFF80" />
      </Pressable>
    </Pressable>
  );
};

export default WhatsNewButton;
