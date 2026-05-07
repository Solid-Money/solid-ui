import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import AuthButton from '@/components/AuthButton';
import CardFeesModal from '@/components/CardWaitlist/CardFeesModal';
import CardWaitlistContainer from '@/components/CardWaitlist/CardWaitlistContainer';
import CardWaitlistHeader from '@/components/CardWaitlist/CardWaitlistHeader';
import CardWaitlistHeaderButtons from '@/components/CardWaitlist/CardWaitlistHeaderButtons';
import CardWaitlistHeaderTitle from '@/components/CardWaitlist/CardWaitlistHeaderTitle';
import GetCardButton from '@/components/CardWaitlist/GetCardButton';
import SolidCardSummary from '@/components/CardWaitlist/SolidCardSummary';
import { Text } from '@/components/ui/text';

const CardWaitlistPageDesktop = () => {
  const [feesOpen, setFeesOpen] = useState(false);

  return (
    <CardWaitlistHeader
      content={
        <View className="md:flex-row md:items-center md:justify-between">
          <CardWaitlistHeaderTitle />
          <CardWaitlistHeaderButtons />
        </View>
      }
    >
      <CardWaitlistContainer>
        <View className="flex-1 justify-center gap-10 bg-transparent px-12 py-10">
          <SolidCardSummary />

          <View className="flex-row items-center gap-6">
            <AuthButton>
              <GetCardButton />
            </AuthButton>
            <Pressable
              onPress={() => setFeesOpen(true)}
              className="flex-row items-center gap-1 web:hover:opacity-70"
            >
              <Text className="text-base font-bold">Fees and charges</Text>
              <ChevronRight size={16} color="white" />
            </Pressable>
          </View>
        </View>
      </CardWaitlistContainer>

      <CardFeesModal isOpen={feesOpen} onOpenChange={setFeesOpen} />
    </CardWaitlistHeader>
  );
};

export default CardWaitlistPageDesktop;
