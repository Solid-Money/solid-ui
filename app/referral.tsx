import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { ChevronLeft, Clipboard as ClipboardIcon } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { Status } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

import InfoError from '@/assets/images/info-error';
import Input from '@/components/ui/input';

const inviteSchema = z.object({
  inviteCode: z.string().nonempty('Referral code is required'),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export default function Invite() {
  const router = useRouter();
  const { handleSignup } = useUser();
  const { signupInfo, setSignupInfo, signupUser } = useUserStore();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    reset,
    setValue,
    trigger,
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    mode: 'onChange',
    defaultValues: {
      inviteCode: '',
    },
  });

  const watchedInviteCode = watch('inviteCode');

  const handlePasteInviteCode = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const code = `${watchedInviteCode}${text}`.trim();
      setValue('inviteCode', code);
      trigger('inviteCode');
    } catch (error) {
      console.error('Error pasting referral code:', error);
    }
  };

  const handleInviteForm = (data: InviteFormData) => {
    handleSignup(signupUser.username, data.inviteCode);
  };

  const getInviteButtonText = () => {
    if (signupInfo.status === Status.PENDING) return 'Creating';
    if (!watchedInviteCode) return 'Create account';
    if (!isValid) return 'Enter valid information';
    return 'Create Account';
  };

  const getInviteCodeErrorText = useMemo(() => {
    if (errors.inviteCode) return errors.inviteCode.message;
    if (signupInfo.status === Status.ERROR) return signupInfo.message || 'Error creating account';
    return '';
  }, [errors.inviteCode, signupInfo.status, signupInfo.message]);

  // const isInviteDisabled = () => {
  //   return signupInfo.status === Status.PENDING || !isValid || !watchedInviteCode;
  // };

  const handleBack = () => {
    router.push(path.REGISTER);
  };

  useEffect(() => {
    if (signupUser.inviteCode) {
      setValue('inviteCode', signupUser.inviteCode);
      trigger('inviteCode');
    }
  }, [signupUser.inviteCode, setValue, trigger]);

  useEffect(() => {
    setSignupInfo({ status: Status.IDLE, message: '' });
  }, [setSignupInfo]);

  useEffect(() => {
    if (signupInfo.status === Status.SUCCESS) {
      reset();
    }
  }, [signupInfo.status, reset]);

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1 md:justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
        <View className="justify-center items-center gap-7">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 74, height: 80 }}
            contentFit="contain"
          />
          <Text className="text-3xl font-semibold text-center">Welcome!</Text>
        </View>

        <View className="gap-6 md:gap-4">
          <Pressable
            onPress={handleBack}
            className="flex-row justify-between items-center gap-2 web:hover:opacity-70"
          >
            <ChevronLeft color="white" />
            <Text className="text-xl text-center font-bold">Do you have a referral code?</Text>
            <View className="w-4" />
          </Pressable>

          <Text className="leading-5 text-muted-foreground text-center font-medium max-w-64 mx-auto">
            Get special benefits when you join through a friend
          </Text>
        </View>

        <View className="gap-5 md:mt-4">
          <View>
            <Controller
              control={control}
              name="inviteCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  id="inviteCode"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter referral code"
                  //className="w-full h-full text-lg text-foreground font-semibold placeholder:text-muted-foreground web:focus:outline-none"
                  className={cn(
                    'flex-row items-center justify-between gap-2 h-14 px-6 rounded-xl border bg-[#111111]',
                    errors.inviteCode ? 'border-red-500' : 'border-border',
                  )}
                />
              )}
            />
            <Pressable
              onPress={handlePasteInviteCode}
              className="opacity-70 web:hover:opacity-100 absolute"
              style={{ right: 20, top: 18 }}
            >
              <ClipboardIcon size={18} color="white" />
            </Pressable>
          </View>
          {getInviteCodeErrorText ? (
            <View className="flex-row items-center gap-2">
              <InfoError />
              <Text className="text-sm text-red-400">{getInviteCodeErrorText}</Text>
            </View>
          ) : null}
          {Boolean(watchedInviteCode) && (
            <Button
              variant="brand"
              onPress={handleSubmit(handleInviteForm)}
              //disabled={isInviteDisabled()}
              className="rounded-xl h-14"
            >
              <Text className="text-lg font-semibold">{getInviteButtonText()}</Text>
              {signupInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
            </Button>
          )}
          <Button
            onPress={() => handleSignup(signupUser.username, 'Skip')}
            variant={Boolean(watchedInviteCode) ? 'ghost' : 'brand'}
            className="rounded-2xl h-14 border-0"
          >
            <Text className="text-lg font-semibold">Skip</Text>
            {signupInfo.status === Status.PENDING && !Boolean(watchedInviteCode) && (
              <ActivityIndicator color="gray" />
            )}
          </Button>
          {!Boolean(watchedInviteCode) && (
            <Link
              href="https://docs.solid.xyz/getting-started-on-solid/solid-private-launch"
              target="_blank"
              className="text-muted-foreground font-bold hover:opacity-70 mx-auto mt-4"
            >
              {"I don't have a referral code"}
            </Link>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
