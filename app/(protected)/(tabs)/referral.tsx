import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import CopyToClipboard from '@/components/CopyToClipboard';
import PageLayout from '@/components/PageLayout';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { getAsset } from '@/lib/assets';

export default function Referral() {
  const { user } = useUser();

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 justify-center gap-10 px-4 py-8">
        <View className="mx-auto w-full gap-5 md:gap-5">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-center text-lg font-semibold text-white md:text-xl">
              Share your referral code
            </Text>
            <View className="w-10" />
          </View>
          <View className="w-full flex-col items-center justify-center">
            <Image
              source={getAsset('images/referral_large.png')}
              style={{ width: 250, height: 250 }}
            />
            <Text className="mt-8 text-center text-white/70">
              Earn 10% of your referral&apos;s points
            </Text>
            <Text className="mt-1 text-center text-white/70">
              Know who referred you?&nbsp;
              <Link href={path.ADD_REFERRER} className="hover:opacity-70">
                <Text className="leading-4 web:underline">
                  Add them so <br />
                  you both get credit
                </Text>
              </Link>
            </Text>
            <View className="w-full flex-col justify-center">
              <Text className="mt-8 text-left text-white/70">Referral code</Text>
            </View>
            <View className="mt-4 w-full flex-row items-center justify-between rounded-2xl bg-primary/10 p-4 ps-6 font-medium text-primary">
              <Text className="text-base">{user?.referralCode}</Text>
              <CopyToClipboard text={user?.referralCode || ''} />
            </View>
            <View className="mt-4 w-full flex-col justify-center">
              <Text className="mt-8 text-left text-white/70">Referral link</Text>
            </View>
            <View className="mt-4 w-full flex-row items-center justify-between rounded-2xl bg-primary/10 p-4 ps-6 font-medium text-primary">
              <Text className="text-base">
                https://www.solid.xyz/refer?ref={user?.referralCode}
              </Text>
              <CopyToClipboard text={`https://www.solid.xyz/refer?ref=${user?.referralCode}`} />
            </View>
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
