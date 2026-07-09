import { Redirect } from 'expo-router';

import { path } from '@/constants/path';

/**
 * The standalone referral page has been replaced by the referral program popup.
 * Anyone landing on `/referral` (old links, bookmarks, in-app navigation) is
 * redirected to `/rewards?referral=open`, which opens the popup on the rewards
 * screen.
 */
export default function Referral() {
  return <Redirect href={path.REFERRAL_PROGRAM} />;
}
