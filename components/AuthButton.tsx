import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import useUser from '@/hooks/useUser';

import type { Href } from 'expo-router';

interface AuthButtonProps {
  children: ReactNode;
}

const AuthButton = ({ children }: AuthButtonProps) => {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  if (user) {
    return <>{children}</>;
  }

  return (
    <Pressable
      onPress={() => {
        router.push(`/?redirected-from=${pathname}` as Href);
      }}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

export default AuthButton;
