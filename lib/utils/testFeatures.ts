import * as Updates from 'expo-updates';

export const TEST_FEATURES_ALLOW_LIST = [
  'Mark1',
  'mayank18',
  'mayankmittal',
  'smargon4',
  'LukaFuse',
  'Test',
  'InternSolid22',
  'mul53',
  'vigor-homey.2z',
  'maxxb.34980',
  'cimal67977',
  'vesas62360',
  'smargonaq1',
];

/**
 * Whether this build is an internal/QA build (EAS "preview" or "development"
 * channel) or local dev. On these builds every user sees the test features, so
 * QA testers no longer need to be added to the allow-list. Production builds
 * (the "production" channel) fall back to the per-user allow-list below.
 */
export const isInternalBuild = (): boolean => {
  if (__DEV__) return true;
  // Updates.channel is the EAS channel the build was created for; null on web /
  // when updates aren't configured.
  const channel = Updates.channel;
  return channel === 'preview' || channel === 'development';
};

export const isUserAllowedToUseTestFeature = (username: string) => {
  if (isInternalBuild()) return true;
  return (
    TEST_FEATURES_ALLOW_LIST.includes(username.toLowerCase()) ||
    TEST_FEATURES_ALLOW_LIST.includes(username)
  );
};
