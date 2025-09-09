import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ChevronLeft, Clipboard as ClipboardIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { Status } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';
import { path } from '@/constants/path';

import InfoError from '@/assets/images/info-error';

const inviteSchema = z.object({
  inviteCode: z.string().nonempty('Invite code is required'),
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
      console.error('Error pasting invite code:', error);
    }
  };

  const handleInviteForm = (data: InviteFormData) => {
    handleSignup(signupUser.username, data.inviteCode);
  };

  const getInviteButtonText = () => {
    if (signupInfo.status === Status.PENDING) return 'Creating';
    if (!watchedInviteCode) return 'Enter an invite code';
    if (!isValid) return 'Enter valid information';
    return 'Create Account';
  };

  const getInviteCodeErrorText = useMemo(() => {
    if (errors.inviteCode) return errors.inviteCode.message;
    if (signupInfo.status === Status.ERROR) return signupInfo.message || 'Error creating account';
    return '';
  }, [errors.inviteCode, signupInfo.status, signupInfo.message]);

  const isInviteDisabled = () => {
    return signupInfo.status === Status.PENDING || !isValid || !watchedInviteCode;
  };

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
        <View className="hidden md:flex items-center gap-5">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 60, height: 60 }}
            contentFit="contain"
          />
          <Text className="text-3xl font-semibold">Welcome!</Text>
        </View>

        <View className="gap-6 md:gap-2">
          <Pressable
            onPress={handleBack}
            className="flex-row justify-between items-center gap-2 web:hover:opacity-70"
          >
            <ChevronLeft color="white" />
            <Text className="text-xl font-bold">Do you have an invite code?</Text>
            <View className="w-4" />
          </Pressable>

          <Text className="text-muted-foreground text-center max-w-xs mx-auto">
            In order to create an account on solid you need to enter an invite code
          </Text>
        </View>

        <View className="gap-2 md:mt-4 flex-1 md:flex-none">
          <View
            className={cn(
              'flex-row items-center justify-between gap-2 h-14 px-6 rounded-xl border',
              errors.inviteCode ? 'border-red-500' : 'border-border',
            )}
          >
            <Controller
              control={control}
              name="inviteCode"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  id="inviteCode"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Enter invite code"
                  className="w-full h-full text-lg text-foreground font-semibold placeholder:text-muted-foreground web:focus:outline-none"
                />
              )}
            />
            <Pressable onPress={handlePasteInviteCode} className="web:hover:opacity-70">
              <ClipboardIcon size={18} color="white" />
            </Pressable>
          </View>
          {getInviteCodeErrorText ? (
            <View className="flex-row items-center gap-2">
              <InfoError />
              <Text className="text-sm text-red-400">{getInviteCodeErrorText}</Text>
            </View>
          ) : null}
          <Button
            variant="brand"
            onPress={handleSubmit(handleInviteForm)}
            disabled={isInviteDisabled()}
            className="rounded-xl h-14 mt-auto"
          >
            <Text className="text-lg font-semibold">{getInviteButtonText()}</Text>
            {signupInfo.status === Status.PENDING && <ActivityIndicator color="gray" />}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
