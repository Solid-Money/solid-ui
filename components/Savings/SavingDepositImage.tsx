import { Image } from 'expo-image';

import { useDimension } from '@/hooks/useDimension';

const SavingDepositImage = () => {
  const { isScreenMedium } = useDimension();
  
  return (
    <Image
      source={require('@/assets/images/solid-purple-large.png')}
      contentFit="contain"
      style={{
        width: isScreenMedium ? 349 : 233,
        height: isScreenMedium ? 378 : 252,
        marginTop: isScreenMedium ? -30 : -15,
        marginBottom: -30,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    />
  );
};

export default SavingDepositImage;
