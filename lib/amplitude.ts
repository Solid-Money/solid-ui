import { Identify, identify, init, setUserId, track } from '@amplitude/analytics-react-native';

import { EXPO_PUBLIC_AMPLITUDE_API_KEY } from './config';
import { toTitleCase } from './utils/utils';

export enum AmplitudeEvent {
  PAGE_VIEWED = '[Amplitude] Page Viewed',
}

export const initAmplitude = () => {
  try {
    init(EXPO_PUBLIC_AMPLITUDE_API_KEY);
  } catch (error) {
    console.error('Error initializing Amplitude:', error);
  }
};

export const trackAmplitudeEvent = (event: string, params: Record<string, any>) => {
  try {
    track(toTitleCase(event), params);
  } catch (error) {
    console.error('Error tracking Amplitude event:', error);
  }
};

export const trackAmplitudeScreen = (pathname: string, params: Record<string, any>) => {
  try {
    track(AmplitudeEvent.PAGE_VIEWED,
      {
        pathname,
        params,
      }
    );
  } catch (error) {
    console.error('Error tracking Amplitude screen:', error);
  }
};

export const trackAmplitudeIdentity = (id: string, params: Record<string, any>) => {
  try {
    setUserId(id);
    const identifyObj = new Identify();
    identifyObj.set('user_properties', params);
    identify(identifyObj);
  } catch (error) {
    console.error('Error tracking Amplitude identity:', error);
  }
};
