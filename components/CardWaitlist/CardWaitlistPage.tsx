import CardWaitlistPageDesktop from '@/components/CardWaitlist/CardWaitlistPageDesktop';
import CardWaitlistPageMobile from '@/components/CardWaitlist/CardWaitlistPageMobile';
import { useDimension } from '@/hooks/useDimension';

const CardWaitlistPage = () => {
  const { isScreenMedium } = useDimension();

  return isScreenMedium ? <CardWaitlistPageDesktop /> : <CardWaitlistPageMobile />;
};

export default CardWaitlistPage;
