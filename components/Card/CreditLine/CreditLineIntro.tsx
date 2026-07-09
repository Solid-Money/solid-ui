import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshCw, ShoppingCart, Sun, Zap } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { CREDIT_LINE_MODAL } from '@/constants/modals';
import { path } from '@/constants/path';
import { formatNumber } from '@/lib/utils';
import { useCreditLineStore } from '@/store/useCreditLineStore';

import { CreditLineLayout, RateBreakdownCard } from './CreditLineShared';
import { useCreditLine } from './useCreditLine';

const STEPS = [
  {
    Icon: Zap,
    title: 'Borrow against your savings',
    description: 'They stay invested and back your loan. Nothing is sold or withdrawn.',
  },
  {
    Icon: ShoppingCart,
    title: 'Spend it instantly',
    description: 'Dollars land in your card balance, ready to use anywhere.',
  },
  {
    Icon: Sun,
    title: 'Keep earning while you borrow',
    description: 'Your savings keep earning — usually more than the borrow costs.',
  },
  {
    Icon: RefreshCw,
    title: 'Repay anytime',
    description: 'No fixed payments, no penalties. Repay whenever, and your savings free up.',
  },
];

/**
 * Credit line intro. Shown when the user has no active borrow position:
 *  - no savings  → educational, "Add to savings"
 *  - has savings → "You have $X available to borrow", "Start Borrowing"
 */
export default function CreditLineIntro() {
  const { hasSavings, maxBorrow } = useCreditLine();
  const router = useRouter();
  const setCreditModal = useCreditLineStore(state => state.setModal);

  const handleAddToSavings = () => {
    setCreditModal(CREDIT_LINE_MODAL.CLOSE);
    router.push(path.SAVINGS);
  };

  const handleStartBorrowing = () => setCreditModal(CREDIT_LINE_MODAL.OPEN_FORM);

  return (
    <CreditLineLayout
      bodyClassName="gap-6"
      footer={
        <Button
          variant="brand"
          className="h-12 rounded-2xl"
          onPress={hasSavings ? handleStartBorrowing : handleAddToSavings}
        >
          <Text className="native:text-lg text-base font-bold text-black">
            {hasSavings ? 'Start Borrowing' : 'Add to savings'}
          </Text>
        </Button>
      }
    >
      <View className="gap-2">
        {hasSavings ? (
          <Text className="text-center text-[26px] font-semibold leading-8 text-white">
            You have <Text className="text-brand">${formatNumber(maxBorrow, 0)}</Text> available to
            borrow
          </Text>
        ) : (
          <Text className="text-center text-[26px] font-semibold leading-8 text-white">
            Borrowing is powered by your savings
          </Text>
        )}
        <Text className="text-center text-sm text-white/60">
          {hasSavings
            ? 'Those dollars can land in your card balance today while your savings keep earning yield.'
            : 'Add dollars to your savings and borrow against them instantly — while they keep earning yield.'}
        </Text>
      </View>

      <RateBreakdownCard />

      <View className="gap-4">
        <Text className="text-base text-white/50">How borrowing works</Text>
        {STEPS.map(({ Icon, title, description }) => (
          <View key={title} className="flex-row gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              <Icon size={20} color="#94F27F" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold text-white">{title}</Text>
              <Text className="text-sm text-white/50">{description}</Text>
            </View>
          </View>
        ))}
      </View>
    </CreditLineLayout>
  );
}
