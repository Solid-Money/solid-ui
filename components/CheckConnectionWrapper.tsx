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
  const { loginInfo } = useUserStore();

  if (loginInfo.status === Status.PENDING) {
    return <Button className={cn('animate-pulse', className)} disabled {...props} />;
  }

  return children;
};
