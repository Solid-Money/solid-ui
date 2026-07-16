import { useState } from 'react';
import { View } from 'react-native';

import CircularProgress from '@/components/Home/CircularProgress';
import FinishSetupModal from '@/components/Home/FinishSetupModal';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useHomeSetupSteps } from '@/hooks/useHomeSetupSteps';

interface HomeVerificationCardProps {
  /** Whether the user has already funded their account (deposit step). */
  depositCompleted: boolean;
  className?: string;
}

/**
 * "Finish verification" card for the redesigned home screen. Reuses the shared
 * setup-steps flow (useHomeSetupSteps + FinishSetupModal + CircularProgress) with
 * the redesigned copy and a brand "Get verified" CTA. Separate from the legacy
 * HomeCardSetup so the public/legacy home is unaffected.
 */
const HomeVerificationCard = ({ depositCompleted, className }: HomeVerificationCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { steps, completedCount, total, firstIncomplete } = useHomeSetupSteps(depositCompleted);

  return (
    <>
      <View className={className}>
        <View className="rounded-twice bg-card p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-1 pr-4">
              <Text className="text-2xl font-semibold text-foreground">Finish verification</Text>
              <Text className="text-sm leading-tight text-muted-foreground">
                You&apos;re a few steps from setting up your card.
              </Text>
              <Button
                variant="brand"
                className="mt-4 h-10 self-start rounded-full px-5"
                onPress={() => setIsOpen(true)}
              >
                <Text className="text-sm font-bold text-primary-foreground">Get verified</Text>
              </Button>
            </View>
            <CircularProgress completed={completedCount} total={total} />
          </View>
        </View>
      </View>

      <FinishSetupModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        steps={steps}
        firstIncomplete={firstIncomplete}
      />
    </>
  );
};

export default HomeVerificationCard;
