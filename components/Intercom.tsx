import { Platform } from 'react-native';
import { IntercomProvider } from 'react-use-intercom';

import { EXPO_PUBLIC_INTERCOM_APP_ID } from '@/lib/config';

type IntercomProps = {
  children: React.ReactNode;
};

const Intercom = ({ children }: IntercomProps) => {
  if (Platform.OS !== 'web') {
    return children;
  }

  return (
    <IntercomProvider appId={EXPO_PUBLIC_INTERCOM_APP_ID} autoBoot>
      {children}
    </IntercomProvider>
  );
};

export default Intercom;
