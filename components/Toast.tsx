import { View } from 'react-native';
import Toast, { BaseToastProps, ToastProps } from 'react-native-toast-message';
import { Href, Link } from 'expo-router';
import { ExternalLink, X } from 'lucide-react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TokenIcon } from '@/lib/types';
import { cn } from '@/lib/utils';

import RenderTokenIcon from './RenderTokenIcon';

interface IBaseToast extends BaseToastProps {
  classNames?: {
    badge?: string;
    badgeText?: string;
  };
  props?: {
    link?: Href;
    linkText?: string;
    image?: TokenIcon;
    badgeText?: string;
  };
}

const BaseToast = ({ text1, text2, classNames, props }: IBaseToast) => {
  const { link, linkText, image, badgeText = 'Onchain' } = props || {};
  return (
    <View
      className="ml-auto h-full w-full max-w-md flex-row justify-between rounded-2xl bg-card"
      style={{ marginRight: 40 }}
      role="alert"
    >
      <View className="flex-1 flex-row items-center justify-between p-4">
        <View className="gap-2">
          <Text className="font-medium">{text1}</Text>
          {(text2 || image) && (
            <View className="flex-row items-center gap-1">
              {image && <RenderTokenIcon tokenIcon={image} size={20} />}
              {text2 && <Text className="opacity-50">{text2}</Text>}
            </View>
          )}
        </View>
        <View className="items-end gap-2">
          {badgeText ? (
            <View className={cn('rounded-md border px-1 py-0.5', classNames?.badge)}>
              <Text className={cn('text-sm', classNames?.badgeText)}>{badgeText}</Text>
            </View>
          ) : null}
          {link && (
            <Link href={link} target="_blank" className="opacity-50 web:hover:opacity-100">
              <View className="flex-row items-center gap-1">
                <ExternalLink color="white" size={16} />
                {linkText && <Text className="underline underline-offset-2">{linkText}</Text>}
              </View>
            </Link>
          )}
        </View>
      </View>
      <Button
        onPress={() => Toast.hide()}
        variant="ghost"
        className="h-auto rounded-l-none rounded-r-2xl border-l border-primary/10 px-4 text-accent-foreground web:hover:border-accent"
      >
        <X />
      </Button>
    </View>
  );
};

const toastConfig = {
  success: ({ text1, text2, props }: IBaseToast) => (
    <BaseToast
      text1={text1}
      text2={text2}
      props={props}
      classNames={{
        badge: 'border-brand',
        badgeText: 'text-brand',
      }}
    />
  ),
  error: ({ text1, text2, props }: IBaseToast) => (
    <BaseToast
      text1={text1}
      text2={text2}
      props={props}
      classNames={{
        badge: 'border-red-400',
        badgeText: 'text-red-400',
      }}
    />
  ),
};

export const toastProps: ToastProps = {
  position: 'bottom',
  config: toastConfig,
  visibilityTime: 30000,
};
