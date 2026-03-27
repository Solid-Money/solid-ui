import { cloneElement, ReactElement, useCallback } from 'react';
import { useRouter } from 'expo-router';

import { path } from '@/constants/path';
import useUser from '@/hooks/useUser';
import { REDIRECTED_FROM_PARAM } from '@/lib/utils';

type ButtonLikeChild = ReactElement<{
  onPress?: (...args: any[]) => void;
}>;

type AuthButtonProps = {
  children: ButtonLikeChild;
};

const AuthButton = ({ children }: AuthButtonProps) => {
  const router = useRouter();
  const { user } = useUser();

  const handlePress = useCallback(
    (...args: any[]) => {
      if (!user) {
        router.push({
          pathname: path.HOME,
          params: {
            [REDIRECTED_FROM_PARAM]: path.CARD_WAITLIST,
          },
        });
        return;
      }

      children.props.onPress?.(...args);
    },
    [children, router, user],
  );

  return cloneElement(children, { onPress: handlePress });
};

export default AuthButton;
