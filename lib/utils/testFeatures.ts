export const TEST_FEATURES_ALLOW_LIST = ['Mark1', 'mayank18', 'smargon4', 'LukaFuse', 'Test'];

export const isUserAllowedToUseTestFeature = (username: string) => {
  return (
    TEST_FEATURES_ALLOW_LIST.includes(username.toLowerCase()) ||
    TEST_FEATURES_ALLOW_LIST.includes(username)
  );
};
