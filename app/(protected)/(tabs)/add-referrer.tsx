import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import InfoError from '@/assets/images/info-error';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { addReferrer, fetchPoints } from '@/lib/api';

export default function AddReferrer() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasReferrer, setHasReferrer] = useState(false);
  const [checkingReferrer, setCheckingReferrer] = useState(true);

  useEffect(() => {
    const checkReferrer = async () => {
      try {
        const points = await fetchPoints();
        if (points.userRefferer) {
          setHasReferrer(true);
        }
      } catch (error) {
        console.error('Failed to check referrer:', error);
      } finally {
        setCheckingReferrer(false);
      }
    };

    checkReferrer();
  }, []);

  const onSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await addReferrer(code);
      router.push(path.POINTS);
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Error, check if the code is valid and you have not added it already';
      if (error instanceof Response) {
        try {
          const errorData = await error.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If JSON parsing fails, use default message
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onChangeCode = (text: string) => {
    setCode(text);
  };

  return (
    <PageLayout desktopOnly>
      <View className="mx-auto w-full max-w-lg flex-1 justify-center gap-10 px-4 py-8">
        <View className="mx-auto w-full gap-5 md:gap-5">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-center text-lg font-semibold text-white md:text-xl">
              Enter your friend&apos;s referral code
            </Text>
            <View className="w-10" />
          </View>
          <View className=" w-full">
            {checkingReferrer ? (
              <View className="flex items-center justify-center py-8">
                <ActivityIndicator color="#cccccc" />
              </View>
            ) : hasReferrer ? (
              <View className="rounded-xl bg-[#1A1A1A] p-4">
                <Text className="mb-2 text-sm text-white/70">
                  You have already added a referrer
                </Text>
                <Text className="text-base text-white">Referrers cannot be changed once set.</Text>
              </View>
            ) : (
              <>
                <View className="w-full flex-col justify-center">
                  <Text className="mt-8 text-left text-white/70">Referral code</Text>
                </View>
                <TextInput
                  className="mt-6 h-14 rounded-xl bg-[#1A1A1A] px-4 text-white"
                  placeholder="Enter your friend's referral code"
                  placeholderTextColor="#666"
                  value={code}
                  onChangeText={onChangeCode}
                  autoFocus
                />
                {error && (
                  <View className="my-2 flex-row items-center gap-2">
                    <InfoError />
                    <Text className="text-sm text-red-400">{error}</Text>
                  </View>
                )}
                <Button
                  className="mt-6 h-12 w-full rounded-xl bg-[#94F27F]"
                  onPress={onSubmit}
                  disabled={!code || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="gray" />
                  ) : (
                    <Text className="text-base font-bold text-black">Submit</Text>
                  )}
                </Button>
              </>
            )}
          </View>
        </View>
      </View>
    </PageLayout>
  );
}
