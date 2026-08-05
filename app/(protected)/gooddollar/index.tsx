import { Redirect } from 'expo-router';

import GoodDollarClaim from '@/components/GoodDollar/GoodDollarClaim';
import PageLayout from '@/components/PageLayout';
import { path } from '@/constants/path';
import { isProduction } from '@/lib/config';

export default function GoodDollarScreen() {
  // GoodDollar is an in-development feature: not accessible in production builds.
  // Guards the deep-link/direct-navigation path (the nav entry is gated too).
  if (isProduction) {
    return <Redirect href={path.HOME} />;
  }

  return (
    <PageLayout showNavbar scrollable>
      <GoodDollarClaim />
    </PageLayout>
  );
}
