import WarningNotice from '@/components/WarningNotice';
import { outflowWarningCopy, type TierBalanceOutflowWarning } from '@/lib/tierBalance';

/**
 * What moving this money out of Earn does to a tier held, or being built, on
 * the "Hold in Earn" route. Informational: the form's own button still goes
 * ahead. Draws nothing without a warning, which is every user the route is not
 * staged to.
 */
const TierBalanceOutflowNotice = ({ warning }: { warning: TierBalanceOutflowWarning | null }) => {
  if (!warning) return null;
  const { title, body } = outflowWarningCopy(warning);
  return <WarningNotice title={title} body={body} />;
};

export default TierBalanceOutflowNotice;
