import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';
import { Image } from 'expo-image';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { WhatsNew, WhatsNewStep } from '@/lib/types';
import { cn } from '@/lib/utils';

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

  const renderItem = ({ item }: { item: WhatsNewStep }) => (
    <View className="flex-1">
      <View className="h-64 w-full bg-muted">
        <Image
          source={{ uri: item.imageUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />
      </View>
      <View className="px-6 pt-6">
        <Text className="mb-4 text-2xl font-semibold text-white">{item.title}</Text>
        <Text className="text-base font-medium text-white/70">{item.text}</Text>
      </View>
    </View>
  );

  const isLastStep = activeIndex === whatsNew.steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      carouselRef.current?.next();
    }
  };

  const handleBack = () => {
    carouselRef.current?.prev();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-[560px] overflow-hidden border-0 border-none bg-[#1C1C1E] p-0">
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
                  className="h-10 rounded-[12px] border-none bg-white/10 px-4 active:bg-white/20 web:hover:bg-white/20"
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
              <Button onPress={handleNext} variant="brand" className="h-10 rounded-[12px] px-4">
                <Text className="font-bold text-black">{isLastStep ? 'Done' : 'Next'}</Text>
              </Button>
            </View>
          </View>
        </View>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsNewModal;
