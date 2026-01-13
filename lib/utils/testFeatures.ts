export const TEST_FEATURES_ALLOW_LIST = ['Mark1', 'mayank18'];

export const isUserAllowedToUseTestFeature = (username: string) => {
  return (
    TEST_FEATURES_ALLOW_LIST.includes(username.toLowerCase()) ||
    TEST_FEATURES_ALLOW_LIST.includes(username)
  );
};
