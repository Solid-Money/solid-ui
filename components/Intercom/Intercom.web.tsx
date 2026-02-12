import { useEffect, useRef } from 'react';
import { IntercomProvider, useIntercom } from 'react-use-intercom';

import { EXPO_PUBLIC_INTERCOM_APP_ID } from '@/lib/config';

type IntercomProps = {
  children: React.ReactNode;
};

/**
 * Deferred Intercom boot component.
 * Boots Intercom 3 seconds after mount to avoid blocking FCP.
 */
const DeferredIntercomBoot = () => {
  const { boot } = useIntercom();
  const hasBooted = useRef(false);

  useEffect(() => {
    if (hasBooted.current) return;

    // Defer Intercom boot by 3 seconds to not block initial render
    const timer = setTimeout(() => {
      boot({ hideDefaultLauncher: true });
      hasBooted.current = true;
    }, 3000);

    return () => clearTimeout(timer);
  }, [boot]);

  return null;
};

const Intercom = ({ children }: IntercomProps) => {
  return (
    <IntercomProvider
      appId={EXPO_PUBLIC_INTERCOM_APP_ID}
      autoBoot={false} // Disabled for performance - we boot manually after FCP (First Contentful Paint)
    >
      <DeferredIntercomBoot />
      {children}
    </IntercomProvider>
  );
};

export default Intercom;
