import { initAmplitude, trackAmplitudeEvent, trackAmplitudeIdentity, trackAmplitudeScreen } from '@/lib/amplitude';
import { initFirebase, trackFirebaseEvent, trackFirebaseIdentity, trackFirebaseScreen } from '@/lib/firebase';

export const initAnalytics = () => {
  initAmplitude();
  initFirebase();
};

export const track = (event: string, params: Record<string, any>) => {
  trackAmplitudeEvent(event, params);
  trackFirebaseEvent(event, params);
};

export const trackScreen = (pathname: string, params: Record<string, any>) => {
  trackAmplitudeScreen(pathname, params);
  trackFirebaseScreen(pathname, params);
};

export const trackIdentity = (id: string, params: Record<string, any>) => {
  trackAmplitudeIdentity(id, params);
  trackFirebaseIdentity(id, params);
};
