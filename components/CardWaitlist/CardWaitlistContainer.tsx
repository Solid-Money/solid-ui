import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, Platform } from 'react-native';

import { useDimension } from '@/hooks/useDimension';

type CardWaitlistContainerProps = {
  children: React.ReactNode;
};

const CardWaitlistContainer = ({ children }: CardWaitlistContainerProps) => {
  const { isScreenMedium } = useDimension();

  return (
    <LinearGradient
      colors={['rgba(148, 242, 127, 0.25)', 'rgba(148, 242, 127, 0)']}
      start={isScreenMedium ? { x: 0.5, y: 0 } : { x: 0, y: 0.5 }}
      end={isScreenMedium ? { x: 0.6, y: 1 } : { x: 1, y: 0.7 }}
      className="web:md:flex web:md:flex-row rounded-twice overflow-hidden"
      style={{ minHeight: 500, ...(Platform.OS === 'web' ? {} : { borderRadius: 20 }) }}
    >
      {isScreenMedium ? (
        <ImageBackground
          source={require('@/assets/images/cards-desktop.png')}
          resizeMode="contain"
          className={'flex-1'}
          imageStyle={{
            width: 452,
            height: 587,
            marginTop: isScreenMedium ? -60 : -50,
            marginRight: isScreenMedium ? 50 : -250,
            marginLeft: 'auto',
          }}
        >
          {children}
        </ImageBackground>
      ) : (
        <>{children}</>
      )}
    </LinearGradient>
  );
};

export default CardWaitlistContainer;
