import React from 'react';
import { Redirect } from 'expo-router';

/**
 * The standalone /referral page has been replaced by the referral program
 * popup. Redirect any navigation to /referral (old links, saved deep links,
 * the rewards title "Refer" link) to the rewards screen with the popup open.
 */
export default function Referral() {
  return <Redirect href={{ pathname: '/rewards', params: { referral: 'open' } }} />;
}
