import { X } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { useWhatsNew } from '@/hooks/useWhatsNew';

const WhatsNewButton = () => {
  const { showLatest, whatsNew, isButtonDismissed, dismissButton } = useWhatsNew();

  if (!whatsNew || isButtonDismissed) return null;

  return (
    <Pressable
      onPress={showLatest}
      className="h-9 flex-row items-center gap-1.5 rounded-full bg-[#2C2C2C] pl-4 pr-3 transition-all active:scale-95 active:opacity-80 web:hover:bg-secondary-hover"
    >
      <Text className="text-sm font-medium text-white">What&apos;s new?</Text>
      <Pressable
        onPress={e => {
          e.stopPropagation();
          dismissButton();
        }}
        className="rounded-full p-1 web:hover:bg-white/10"
      >
        <X size={14} color="#666" />
      </Pressable>
    </Pressable>
  );
};

export default WhatsNewButton;
