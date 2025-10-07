import { View } from 'react-native';

import ReserveCardButton from './ReserveCardButton';

const CardWaitlistHeaderButtons = () => {
  return (
    <View className="flex-row items-center gap-2">
      <ReserveCardButton />
    </View>
  );
};

export default CardWaitlistHeaderButtons;
