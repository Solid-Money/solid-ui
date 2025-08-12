import { Image } from 'expo-image';

const SavingDepositImage = () => {
  return (
    <Image
      source={require('@/assets/images/solid-purple-large.png')}
      contentFit="contain"
      style={{ width: 349, height: 378 }}
    />
  );
};

export default SavingDepositImage;
