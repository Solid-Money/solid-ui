import React, { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Carousel from 'react-native-reanimated-carousel';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { TRACKING_EVENTS } from '@/constants/tracking-events';
import { track } from '@/lib/analytics';
import { WhatsNew, WhatsNewStep } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  openWhatsNewLink,
  type WhatsNewDismissMethod,
  whatsNewEventBase,
  whatsNewViewedProps,
} from '@/lib/whatsNew';

// Mirrors the `--brand` design token (see global.css). lucide icons need a
// concrete color value, so it can't be applied via the `text-brand` class.
const BRAND_COLOR = 'hsl(109.04, 81.56%, 72.35%)';

interface WhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewModal = ({ whatsNew, isOpen, onClose }: WhatsNewModalProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = React.useRef<any>(null);
  const { width: screenWidth } = useWindowDimensions();
  const modalWidth = Math.min(screenWidth * 0.9, 560);
  // How the dialog is being closed, for `whats_new_dismissed`. The X is the
  // default; Esc and a press outside say so before the dialog closes.
  const dismissMethodRef = useRef<WhatsNewDismissMethod>('close_button');
  const closedRef = useRef(false);

  useEffect(() => {
    if (isOpen) track(TRACKING_EVENTS.WHATS_NEW_VIEWED, whatsNewViewedProps(whatsNew, 'popup'));
  }, [isOpen, whatsNew]);

  const dismiss = (method: WhatsNewDismissMethod) => {
    if (closedRef.current) return;
    closedRef.current = true;
    track(TRACKING_EVENTS.WHATS_NEW_DISMISSED, {
      ...whatsNewEventBase(whatsNew),
      format: 'carousel',
      method,
      step: activeIndex + 1,
    });
    onClose();
  };

  const handleButtonPress = (link?: string) => {
    const target = link?.trim();
    if (!target) return;

    closedRef.current = true;
    track(TRACKING_EVENTS.WHATS_NEW_CLICKED, {
      ...whatsNewEventBase(whatsNew),
      format: 'carousel',
      link: target,
      step: activeIndex + 1,
    });
    // Close the modal first so the user lands on the destination screen.
    onClose();
    openWhatsNewLink(target);
  };

  const renderItem = ({ item }: { item: WhatsNewStep }) => {
    const hasCta = Boolean(item.buttonLabel?.trim() && item.buttonLink?.trim());

    return (
      <View className="flex-1">
        <View className="h-64 w-full bg-muted">
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
        <View className="px-6 pt-6">
          <Text className="mb-4 text-2xl font-semibold text-white">{item.title}</Text>
          <Text className="text-base font-medium text-white/70">{item.text}</Text>
          {hasCta && (
            <Pressable
              onPress={() => handleButtonPress(item.buttonLink)}
              accessibilityRole="button"
              className="py-1 active:opacity-70 web:hover:opacity-80"
            >
              <View className="mt-4 flex-row items-center gap-0.5 self-start">
                <Text className="text-base font-bold text-brand">{item.buttonLabel}</Text>
                <ChevronRight size={20} color={BRAND_COLOR} strokeWidth={2.5} />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const isLastStep = activeIndex === whatsNew.steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      dismiss('close_button');
    } else {
      carouselRef.current?.next();
    }
  };

  const handleBack = () => {
    carouselRef.current?.prev();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && dismiss(dismissMethodRef.current)}>
      <DialogContent
        className="w-[90vw] max-w-[560px] overflow-hidden border-0 border-none bg-[#1C1C1E] p-0"
        onEscapeKeyDown={() => {
          dismissMethodRef.current = 'esc';
        }}
        onPointerDownOutside={() => {
          dismissMethodRef.current = 'backdrop';
        }}
      >
        <View className="relative">
          <Carousel
            ref={carouselRef}
            loop={false}
            width={modalWidth}
            height={480}
            data={whatsNew.steps}
            onProgressChange={(_, progress) => {
              const nextIndex = Math.round(progress);
              if (
                nextIndex >= 0 &&
                nextIndex < whatsNew.steps.length &&
                nextIndex !== activeIndex
              ) {
                setActiveIndex(nextIndex);
              }
            }}
            renderItem={renderItem}
          />

          <View className="flex-row items-center justify-between px-8 pb-8 pt-6">
            <View className="w-20">
              {activeIndex > 0 && (
                <Button
                  onPress={handleBack}
                  variant="secondary"
                  size="sm"
                  className="h-10 w-[72px] rounded-[100px] border-0 bg-white/10 px-4 active:bg-white/20 web:hover:bg-white/20"
                >
                  <Text className="text-base font-bold text-white/50">Back</Text>
                </Button>
              )}
            </View>

            <View className="flex-row gap-2">
              {whatsNew.steps.map((_, index) => (
                <View
                  key={index}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    activeIndex === index ? 'w-6 bg-white/70' : 'w-1.5 bg-white/30',
                  )}
                />
              ))}
            </View>

            <View className="w-20 items-end">
              <Button
                onPress={handleNext}
                variant="brand"
                size="sm"
                className="h-10 min-w-[72px] rounded-[100px] px-4"
              >
                <Text numberOfLines={1} className="font-bold text-black">
                  {isLastStep ? 'Done' : 'Next'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewModal;
