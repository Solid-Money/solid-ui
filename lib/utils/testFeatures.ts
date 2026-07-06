export const TEST_FEATURES_ALLOW_LIST = [
  'Mark1',
  'mayank18',
  'mayankmittal',
  'smargon4',
  'LukaFuse',
  'Test',
  'InternSolid22',
  'mul53',
];

export const isUserAllowedToUseTestFeature = (username: string) => {
  return (
    TEST_FEATURES_ALLOW_LIST.includes(username.toLowerCase()) ||
    TEST_FEATURES_ALLOW_LIST.includes(username)
  );
};
