import { Image } from 'expo-image';

import { useDimension } from '@/hooks/useDimension';
import { getAsset } from '@/lib/assets';

const SavingDepositImage = () => {
  const { isScreenMedium } = useDimension();

  return (
    <Image
      source={getAsset('images/solid-indigo.png')}
      contentFit="contain"
      style={{
        ...(isScreenMedium && {
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: [{ translateY: '-50%' }],
        }),
        ...(!isScreenMedium && { marginLeft: 'auto', marginRight: 'auto' }),
        width: isScreenMedium ? 349 : 233,
        height: isScreenMedium ? 378 : 252,
      }}
      alt="Savings deposit illustration"
    />
  );
};

export default SavingDepositImage;
