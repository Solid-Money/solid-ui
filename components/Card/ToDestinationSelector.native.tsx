import type { ToDestinationProps } from './ToDestinationSelector.types';

export type { ToDestinationProps };

/**
 * Native and web share one picker now (`ToDestinationSelector.shared.tsx`): the
 * in-flow list this file used to hold, which is the one that works inside the
 * withdraw sheet on both platforms.
 */
export { default } from './ToDestinationSelector.shared';

/**
 * Re-exported so `import { assetLabel } from '.../ToDestinationSelector'`
 * resolves on native too. Metro picks this `.native` file over the `.web` one, so
 * anything the web module exports has to be exported here as well or it silently
 * becomes `undefined` on device.
 */
export { assetLabel } from '@/lib/utils/cardHelpers';
