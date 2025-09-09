import { Platform } from "react-native";
import { useIntercom as useIntercomHook } from 'react-use-intercom';

export const useIntercom = () => {
  if (Platform.OS !== 'web') {
    return null;
  }

  return useIntercomHook();
};
