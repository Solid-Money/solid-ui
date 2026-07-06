import { useState } from 'react';
import { Pressable, View } from 'react-native';

import CircularProgress from '@/components/Home/CircularProgress';
import FinishSetupModal from '@/components/Home/FinishSetupModal';
import { Text } from '@/components/ui/text';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';

interface HomeCardSetupProps {
  /** Whether the user has already funded their account (deposit step) */
  depositCompleted: boolean;
  className?: string;
}

/**
 * "Finish setting up" virtual card shown on the native home screen while the
 * user has not yet obtained a card. Displays a progress ring of completed
 * onboarding steps and opens the full setup modal on press.
 */
const HomeCardSetup = ({ depositCompleted, className }: HomeCardSetupProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { steps, completedCount, total, firstIncomplete } = useHomeSetupSteps(depositCompleted);

  return (
    <>
      <Pressable onPress={() => setIsOpen(true)} className={className}>
        <View className="rounded-twice bg-card p-5">
          <Text className="text-base font-medium text-muted-foreground">Virtual card</Text>
          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-1 gap-1 pr-4">
              <Text className="text-2xl font-semibold text-foreground">Finish setting up</Text>
              <Text className="text-sm leading-tight text-muted-foreground">
                Complete 3 simple steps to{'\n'}start using all benefits
              </Text>
            </View>
            <CircularProgress completed={completedCount} total={total} />
          </View>
        </View>
      </Pressable>

      <FinishSetupModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        steps={steps}
        firstIncomplete={firstIncomplete}
      />
    </>
  );
};

export default HomeCardSetup;
