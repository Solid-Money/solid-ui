import PageLayout from '@/components/PageLayout';
import ReferralProgramContent from '@/components/Referral/ReferralProgramContent';

export default function ReferralProgram() {
  return (
    <PageLayout desktopOnly mobileTitle={null}>
      <ReferralProgramContent />
    </PageLayout>
  );
}
