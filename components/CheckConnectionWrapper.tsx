import { Button } from '@/components/ui/button';
import { useUserStore } from '@/store/useUserStore';
import { Status } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  const { userStatus } = useUserStore();

  if (userStatus === Status.PENDING) {
    return <Button className={cn('animate-pulse', className)} disabled {...props} />;
  }

  return children;
};
