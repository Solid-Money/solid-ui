import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { Text } from '@/components/ui/text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { getAsset } from '@/lib/assets';

type TooltipClassNames = {
  content?: string;
  trigger?: string;
};

interface TooltipProps {
  trigger?: React.ReactNode;
  content?: React.ReactNode;
  text?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
  analyticsContext?: string;
  classNames?: TooltipClassNames;
}

const TooltipPopover = ({
  trigger,
  content,
  text,
  side = 'bottom',
  sideOffset = 4,
  analyticsContext,
  classNames,
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
          source={getAsset('images/question-mark-gray.png')}
          alt="Tooltip"
          style={{ width: 17, height: 17, marginTop: 3 }}
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
      <TooltipTrigger asChild className={classNames?.trigger}>
        {trigger ? <View>{trigger}</View> : getTrigger()}
      </TooltipTrigger>
      <TooltipContent
        insets={contentInsets}
        side={side}
        sideOffset={sideOffset}
        className={classNames?.content}
      >
        {content || getContent()}
      </TooltipContent>
    </Tooltip>
  );
};

export default TooltipPopover;
