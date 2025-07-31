import { Image } from 'react-native';
import { cssInterop } from 'nativewind';

cssInterop(Image, {
  className: {
    target: 'style',
  },
});

export { Image };
