import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import useUser from '@/hooks/useUser';
import { path } from '@/constants/path';
import { eclipseUsername } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserStore } from '@/store/useUserStore';

import PersonKey from '@/assets/images/person-key';

export default function Welcome() {
  const { handleRemoveUsers, handleSelectUser } = useUser();
  const { users } = useUserStore();
  const router = useRouter();

  return (
    <SafeAreaView className="bg-background text-foreground flex-1">
      <View className="flex-1 justify-center gap-10 px-4 py-8 w-full max-w-lg mx-auto">
        <View className="flex-row items-center gap-5">
          <Image
            source={require('@/assets/images/solid-logo-4x.png')}
            alt="Solid logo"
            style={{ width: 37, height: 40 }}
            contentFit="contain"
          />
        </View>

        <View className="gap-8">
          <View className="flex-col gap-2">
            <Text className="text-3xl font-semibold">Welcome back!</Text>
            <Text className="text-muted-foreground max-w-[23rem]">
              Sign up with your email or connect a Web3 wallet to get started.
            </Text>
          </View>

          <View className="gap-2 w-full">
            {!users.length && <Skeleton className="bg-primary/10 rounded-xl h-14" />}
            {users.map(user => (
              <Button
                key={user.username}
                variant="brand"
                className="justify-between rounded-xl h-14 px-6"
                onPress={() => handleSelectUser(user.username)}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="text-lg font-semibold">
                    {eclipseUsername(user.username, 20)}
                  </Text>
                </View>
                <View className="opacity-40">
                  <PersonKey className="size-6" />
                </View>
              </Button>
            ))}
          </View>

          <View className="gap-2 w-full">
            <Button
              variant="secondary"
              className="rounded-xl h-14"
              onPress={() => router.replace(path.REGISTER)}
            >
              <Text className="text-lg font-semibold">Use another account</Text>
            </Button>
            <Button variant="ghost" className="rounded-xl h-14" onPress={handleRemoveUsers}>
              <Text className="text-lg font-semibold text-muted-foreground">Forget all users</Text>
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
