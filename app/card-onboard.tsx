import { Redirect } from 'expo-router';

import { path } from '@/constants/path';

/**
 * `/card-onboard` used to render the standalone card waitlist page — the same
 * deprecated page `/card` served. Both are shims now: this one hands off to
 * `/card`, which branches on card status (details / activate / country
 * selection). Keeping the branching in one place means old links to either URL
 * land on the same current screen.
 */
export default function CardOnboard() {
  return <Redirect href={path.CARD} />;
}
