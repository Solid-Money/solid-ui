import LegacyOnboarding from '@/components/Onboarding/LegacyOnboarding';
import OnboardingNew from '@/components/Onboarding/NewOnboarding/OnboardingNew';
import { useDimension } from '@/hooks/useDimension';

export default function Onboarding() {
  // Mobile gets the redesigned two-step onboarding (landing → welcome sheet);
  // desktop/wide-web keeps the existing carousel + split-screen design.
  const { isDesktop } = useDimension();
  return isDesktop ? <LegacyOnboarding /> : <OnboardingNew />;
}
