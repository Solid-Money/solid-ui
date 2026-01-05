import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Dimensions, View } from 'react-native';
import Carousel from 'react-native-reanimated-carousel';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Text } from '@/components/ui/text';
import { WhatsNew, WhatsNewStep } from '@/lib/types';
import { cn } from '@/lib/utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 480);

interface WhatsNewModalProps {
  whatsNew: WhatsNew;
  isOpen: boolean;
  onClose: () => void;
}

const WhatsNewModal = ({ whatsNew, isOpen, onClose }: WhatsNewModalProps) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = React.useRef<any>(null);

  const renderItem = ({ item }: { item: WhatsNewStep }) => (
    <View className="flex-1">
      <View className="h-64 w-full bg-muted">
        <Image source={{ uri: item.imageUrl }} className="h-full w-full" contentFit="cover" />
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
      <DialogContent className="w-[90vw] max-w-[480px] overflow-hidden border-none bg-[#1C1C1E] p-0">
        <View className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-10 h-8 w-8 rounded-full bg-black/40"
            onPress={onClose}
          >
            <X size={18} color="white" />
          </Button>

          <Carousel
            ref={carouselRef}
            loop={false}
            width={MODAL_WIDTH}
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

          <View className="flex-row items-center justify-between px-6 pb-8 pt-6">
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
