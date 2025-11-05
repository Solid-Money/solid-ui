import InfoError from '@/assets/images/info-error';
import PageLayout from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { path } from '@/constants/path';
import { addReferrer, fetchPoints } from '@/lib/api';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';

export default function AddReferrer() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentReferrer, setCurrentReferrer] = useState<string | null>(null);
  const [fetchingReferrer, setFetchingReferrer] = useState(true);

  useEffect(() => {
    const loadCurrentReferrer = async () => {
      try {
        const points = await fetchPoints();
        setCurrentReferrer(points.userRefferer || null);
      } catch (error) {
        console.error('Failed to fetch current referrer:', error);
      } finally {
        setFetchingReferrer(false);
      }
    };

    loadCurrentReferrer();
  }, []);

  const onSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await addReferrer(code);
      router.push(path.POINTS);
    } catch (error: any) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : 'Error, check if the code is valid and you have not added it already',
      );
    } finally {
      setLoading(false);
    }
  };

  const onChangeCode = (text: string) => {
    setCode(text);
  };

  return (
    <PageLayout desktopOnly>
      <View className="flex-1 justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
        <View className="gap-5 md:gap-5 w-full mx-auto">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => router.back()} className="web:hover:opacity-70">
              <ArrowLeft color="white" />
            </Pressable>
            <Text className="text-white text-lg md:text-xl font-semibold text-center">
              {currentReferrer ? 'Update' : "Enter your friend's"} referral code
            </Text>
            <View className="w-10" />
          </View>
          <View className=" w-full">
            {fetchingReferrer ? (
              <View className="flex items-center justify-center py-8">
                <ActivityIndicator color="white" />
              </View>
            ) : (
              <>
                {currentReferrer && (
                  <View className="bg-[#1A1A1A] rounded-xl p-4 mb-6">
                    <Text className="text-white/70 text-sm mb-1">Current referrer</Text>
                    <Text className="text-white text-base font-semibold">{currentReferrer}</Text>
                  </View>
                )}
                <View className="flex-col justify-center w-full">
                  <Text className="text-white/70 text-left mt-8">
                    {currentReferrer ? 'Update referral code' : 'Referral code'}
                  </Text>
                </View>
                <TextInput
                  className="bg-[#1A1A1A] rounded-xl px-4 h-14 text-white mt-6"
                  placeholder="Enter your friend's referral code"
                  placeholderTextColor="#666"
                  value={code}
                  onChangeText={onChangeCode}
                  autoFocus
                />
                {error && (
                  <View className="flex-row items-center gap-2 my-2">
                    <InfoError />
                    <Text className="text-sm text-red-400">{error}</Text>
                  </View>
                )}
                <Button
                  className="rounded-xl h-12 w-full mt-6 bg-[#94F27F]"
                  onPress={onSubmit}
                  disabled={!code || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="gray" />
                  ) : (
                    <Text className="text-base font-bold text-black">
                      {currentReferrer ? 'Update Referrer' : 'Submit'}
                    </Text>
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
