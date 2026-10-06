import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as TooltipPrimitive from '@rn-primitives/tooltip';

import { TextClassContext } from '@/components/ui/text';
import {
  TOOLTIP_SURFACE_CLASS_NAME,
  TOOLTIP_TEXT_CLASS_NAME,
} from '@/components/ui/tooltip-styles';
import { cn } from '@/lib/utils';

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 4,
  portalHost,
  ...props
}: TooltipPrimitive.ContentProps & {
  ref?: React.RefObject<TooltipPrimitive.ContentRef>;
  portalHost?: string;
}) {
  return (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <TooltipPrimitive.Overlay
        style={
          Platform.OS !== 'web'
            ? [
                StyleSheet.absoluteFill,
                // Android orders sibling portals by their root layer. The content's
                // z-index alone cannot place a tooltip above an elevated dialog.
                Platform.OS === 'android' ? { zIndex: 50, elevation: 50 } : undefined,
              ]
            : undefined
        }
      >
        <View>
          <TextClassContext.Provider value={TOOLTIP_TEXT_CLASS_NAME}>
            <TooltipPrimitive.Content
              sideOffset={sideOffset}
              avoidCollisions={true}
              className={cn(
                'z-50 max-w-[288px] overflow-hidden',
                TOOLTIP_SURFACE_CLASS_NAME,
                className,
              )}
              {...props}
            />
          </TextClassContext.Provider>
        </View>
      </TooltipPrimitive.Overlay>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipTrigger };
