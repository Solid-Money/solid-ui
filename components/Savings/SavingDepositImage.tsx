import { Image } from 'expo-image';

const SavingDepositImage = () => {
  return (
    <Image
      source={require('@/assets/images/solid-purple-large.png')}
      contentFit="contain"
      style={{
        width: 349,
        height: 378,
        marginTop: -30,
        marginBottom: -30,
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    />
  );
};

export default SavingDepositImage;
