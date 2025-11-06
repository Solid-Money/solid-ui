import CopyToClipboard from '@/components/CopyToClipboard';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, View } from 'react-native';

export default function Referral() {
  const { user } = useUser();

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
        <View className="gap-5 md:gap-5 w-full mx-auto">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-white text-lg md:text-xl font-semibold text-center">
              Share your referral code
            </Text>
            <View className="w-10" />
          </View>
          <View className="flex-col items-center justify-center w-full">
            <Image
              source={require('@/assets/images/referral_large.png')}
              style={{ width: 250, height: 250 }}
            />
            <Text className="text-white/70 text-center mt-8">
              Earn 10% of your referral&apos;s points and <br />
              give your self a 10% boost
            </Text>
            <Text className="text-white/70 text-center mt-1">
              Know who referred you?&nbsp;
              <Link href={path.ADD_REFERRER} className="hover:opacity-70">
                <Text className="underline leading-4">
                  Add them so <br />
                  you both get credit
                </Text>
              </Link>
            </Text>
            <View className="flex-col justify-center w-full">
              <Text className="text-white/70 text-left mt-8">Referral code</Text>
            </View>
            <View className="flex-row w-full justify-between items-center p-4 ps-6 bg-primary/10 rounded-2xl text-primary font-medium mt-4">
              <Text>{user?.referralCode}</Text>
              <CopyToClipboard text={user?.referralCode || ''} />
            </View>
            <View className="flex-col justify-center w-full mt-4">
              <Text className="text-white/70 text-left mt-8">Direct register link</Text>
            </View>
            <View className="flex-row w-full justify-between items-center p-4 ps-6 bg-primary/10 rounded-2xl text-primary font-medium mt-4">
              <Text>https://app.solid.xyz/?ref={user?.referralCode}</Text>
              <CopyToClipboard text={`https://app.solid.xyz/?ref=${user?.referralCode}`} />
            </View>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
