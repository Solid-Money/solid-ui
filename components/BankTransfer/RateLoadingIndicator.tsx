import { ActivityIndicator, ActivityIndicatorProps } from 'react-native';

export const RateLoadingIndicator = ({
  size = 'small',
  color = '#A1A1A1',
}: {
  size?: ActivityIndicatorProps['size'] | 'default';
  color?: string;
}) => {
  return <ActivityIndicator size={size === 'default' ? 'small' : size} color={color} />;
};
