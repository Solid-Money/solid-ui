import { useShallow } from 'zustand/react/shallow';

import { Button } from '@/components/ui/button';
import { Status } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/store/useUserStore';

type CheckConnectionWrapperProps = {
  children: React.ReactNode;
  className?: string;
  props?: React.ComponentProps<'button'> | any;
};

export const CheckConnectionWrapper = ({
  children,
  className,
  props,
}: CheckConnectionWrapperProps) => {
  // Use useShallow for object selection to prevent unnecessary re-renders
  const { loginInfo } = useUserStore(
    useShallow(state => ({
      loginInfo: state.loginInfo,
    })),
  );

  if (loginInfo.status === Status.PENDING) {
    return <Button className={cn('animate-pulse', className)} disabled {...props} />;
  }

  return children;
};
