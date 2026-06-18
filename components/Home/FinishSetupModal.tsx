import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';

import ResponsiveModal from '@/components/ResponsiveModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { HomeSetupStep } from '@/hooks/useHomeSetupSteps';
import { getAsset } from '@/lib/assets';

interface FinishSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: HomeSetupStep[];
  firstIncomplete?: HomeSetupStep;
}

const FinishSetupModal = ({ isOpen, onClose, steps, firstIncomplete }: FinishSetupModalProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 35) + 24;

  const handleCta = () => {
    onClose();
    firstIncomplete?.onPress?.();
  };

  const handleLearnMore = () => {
    onClose();
    router.push(path.CARD_WAITLIST);
  };

  return (
    <ResponsiveModal
      currentModal={{ name: 'finish_setup', number: 1 }}
      previousModal={{ name: 'close', number: 0 }}
      isOpen={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
      trigger={null}
      contentKey="finish_setup"
      shouldAnimate={false}
      disableScroll
    >
      <View className="flex-1 justify-between gap-8">
        <View className="items-center gap-6">
          <Image
            source={getAsset('images/rocket-lavender.png')}
            style={{ width: 56, height: 56 }}
            contentFit="contain"
          />

          <View className="items-center gap-2">
            <Text className="text-center text-3xl font-semibold text-foreground">
              Finish setting up
            </Text>
            <Text className="max-w-xs text-center text-base text-muted-foreground">
              Complete 3 simple steps to{'\n'}start using all benefits
            </Text>
          </View>

          <View className="w-full rounded-twice bg-card px-5 py-2">
            {steps.map((step, index) => (
              <View
                key={step.title}
                className="flex-row items-center gap-4 py-3.5"
                style={
                  index < steps.length - 1
                    ? { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }
                    : undefined
                }
              >
                <Check size={22} color={step.completed ? '#94F27F' : '#838383'} strokeWidth={2.5} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-semibold text-foreground">{step.title}</Text>
                  <Text className="text-sm text-muted-foreground">{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-5" style={{ paddingBottom: bottomPadding }}>
          {firstIncomplete && (
            <Button
              className="h-14 rounded-2xl border-0 bg-button-earning web:hover:bg-button-earning web:hover:brightness-110"
              onPress={handleCta}
            >
              <Text className="text-base font-bold text-primary-foreground">
                {firstIncomplete.cta}
              </Text>
            </Button>
          )}
          <Pressable
            onPress={handleLearnMore}
            className="flex-row items-center justify-center gap-1 py-1"
          >
            <Text className="text-base font-semibold text-foreground">
              Learn about the Solid card
            </Text>
            <ChevronRight size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>
    </ResponsiveModal>
  );
};

export default FinishSetupModal;
