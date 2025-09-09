import { Image } from 'expo-image';
import * as React from 'react';
import { Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { track } from '@/lib/firebase';
import { TRACKING_EVENTS } from '@/constants/tracking-events';

interface TooltipProps {
  trigger?: React.ReactNode;
  content?: React.ReactNode;
  text?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  analyticsContext?: string;
}

const TooltipPopover = ({
  trigger,
  content,
  text,
  side = 'bottom',
  sideOffset = 4,
  analyticsContext,
}: TooltipProps) => {
  const insets = useSafeAreaInsets();
  const contentInsets = {
    top: insets.top,
    bottom: insets.bottom,
    left: 12,
    right: 12,
  };

  const getTrigger = () => {
    return (
      <Pressable
        onPress={() => {
          track(TRACKING_EVENTS.TOOLTIP_OPENED, {
            context: analyticsContext || 'unknown',
            tooltip_text: text?.substring(0, 50) || 'custom_content',
          });
        }}
      >
        <Image
          source={require('@/assets/images/question-mark-gray.png')}
          alt="Tooltip"
          style={{ width: 16, height: 16 }}
          contentFit="contain"
        />
      </Pressable>
    );
  };

  const getContent = () => {
    return (
      <Text
        className="text-sm leading-5"
        style={{
          maxWidth: 280,
          textAlign: 'left',
        }}
      >
        {text}
      </Text>
    );
  };

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{trigger || getTrigger()}</TooltipTrigger>
      <TooltipContent insets={contentInsets} side={side} sideOffset={sideOffset}>
        {content || getContent()}
      </TooltipContent>
    </Tooltip>
  );
};

export default TooltipPopover;
