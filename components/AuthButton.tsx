import { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';

import useUser from '@/hooks/useUser';
import { useUserStore } from '@/store/useUserStore';

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
        useUserStore.getState().setRedirectFrom(pathname);
        router.push('/');
      }}
    >
      <View pointerEvents="none">{children}</View>
    </Pressable>
  );
};

export default AuthButton;
