import { View } from 'react-native';

import AuthButton from './AuthButton';
import GetCardButton from './GetCardButton';

const CardWaitlistHeaderButtons = () => {
  return (
    <View className="flex-row items-center gap-2">
      <AuthButton>
        <GetCardButton />
      </AuthButton>
    </View>
  );
};

export default CardWaitlistHeaderButtons;
