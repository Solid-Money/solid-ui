import { View } from 'react-native';

import GetCardButton from './GetCardButton';

const CardWaitlistHeaderButtons = () => {
  return (
    <View className="flex-row items-center gap-2">
      <GetCardButton />
    </View>
  );
};

export default CardWaitlistHeaderButtons;
