import { Image } from "expo-image";
import { Href, Link } from 'expo-router';
import { View } from 'react-native';
import { ExternalLink, X } from 'lucide-react-native';
import Toast, { BaseToastProps, ToastProps } from 'react-native-toast-message';
import { cn } from "@/lib/utils";

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

interface IBaseToast extends BaseToastProps {
  classNames?: {
    badge?: string;
    badgeText?: string;
  }
  props?: {
    link?: Href;
    linkText?: string;
    image?: string;
  };
}

const BaseToast = ({ text1, text2, classNames, props }: IBaseToast) => {
  return (
    <View className='flex-row justify-between ml-auto bg-card rounded-2xl w-full h-full max-w-md' style={{ marginRight: 40 }} role="alert">
      <View className='flex-row justify-between items-center p-4 flex-1'>
        <View className='gap-2'>
          <Text className="font-medium">{text1}</Text>
          <View className='flex-row items-center gap-1'>
            {props?.image && (
              <Image
                source={props.image}
                style={{ width: 20, height: 20 }}
                contentFit="contain"
              />
            )}
            {text2 && (
              <Text className="opacity-50">{text2}</Text>
            )}
          </View>
        </View>
        <View className='items-end gap-2'>
          <View className={cn('border rounded-md px-1 py-0.5', classNames?.badge)}>
            <Text className={cn('text-sm', classNames?.badgeText)}>Onchain</Text>
          </View>
          {props?.link && (
            <Link
              href={props.link}
              target='_blank'
              className='opacity-50 web:hover:opacity-100'
            >
              <View className='flex-row items-center gap-1'>
                <ExternalLink color='white' size={16} />
                {props.linkText && (
                  <Text className='underline underline-offset-2'>{props.linkText}</Text>
                )}
              </View>
            </Link>
          )}
        </View>
      </View>
      <Button
        onPress={() => Toast.hide()}
        variant='ghost'
        className='px-4 h-auto border-l border-primary/10 web:hover:border-accent rounded-l-none rounded-r-2xl text-accent-foreground'
      >
        <X />
      </Button>
    </View>
  )
}

const toastConfig = {
  success: ({ text1, text2, props }: IBaseToast) =>
    <BaseToast
      text1={text1}
      text2={text2}
      props={props}
      classNames={{
        badge: 'border-brand',
        badgeText: 'text-brand',
      }}
    />,
  error: ({ text1, text2, props }: IBaseToast) =>
    <BaseToast
      text1={text1}
      text2={text2}
      props={props}
      classNames={{
        badge: 'border-red-400',
        badgeText: 'text-red-400',
      }}
    />,
};

export const toastProps: ToastProps = {
  position: 'bottom',
  config: toastConfig,
  visibilityTime: 10000,
}
