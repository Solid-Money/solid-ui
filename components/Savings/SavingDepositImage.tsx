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
