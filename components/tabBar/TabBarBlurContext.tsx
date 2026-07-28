import {
  createContext,
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

type TabBarBlurContextValue = {
  blurTarget?: RefObject<View | null>;
  setBlurTarget: Dispatch<SetStateAction<RefObject<View | null> | undefined>>;
};

const TabBarBlurContext = createContext<TabBarBlurContextValue | undefined>(undefined);

export function TabBarBlurProvider({ children }: { children: ReactNode }) {
  const [blurTarget, setBlurTarget] = useState<RefObject<View | null>>();
  const value = useMemo(() => ({ blurTarget, setBlurTarget }), [blurTarget]);

  return <TabBarBlurContext.Provider value={value}>{children}</TabBarBlurContext.Provider>;
}

export function useTabBarBlurTarget() {
  return useContext(TabBarBlurContext)?.blurTarget;
}

export function useRegisterTabBarBlurTarget(blurTarget: RefObject<View | null>, enabled: boolean) {
  const setBlurTarget = useContext(TabBarBlurContext)?.setBlurTarget;

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !setBlurTarget) return;

      setBlurTarget(blurTarget);

      return () => {
        setBlurTarget(current => (current === blurTarget ? undefined : current));
      };
    }, [blurTarget, enabled, setBlurTarget]),
  );
}
