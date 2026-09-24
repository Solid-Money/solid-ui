import type { ToDestinationProps } from './ToDestinationSelector.types';

export type { ToDestinationProps };

/**
 * Web renders the same in-flow picker as native — see
 * `ToDestinationSelector.shared.tsx` for why the portalled dropdown menu that
 * used to live here had to go.
 */
export { default } from './ToDestinationSelector.shared';

/**
 * Re-exported so `import { assetLabel } from '.../ToDestinationSelector'` keeps
 * resolving on web. The helper itself is platform-neutral and lives in
 * `cardHelpers`; both platform variants must export the same names or the one
 * that does not silently hands callers `undefined` (see
 * `__tests__/toDestinationSelectorExports.test.ts`).
 */
export { assetLabel } from '@/lib/utils/cardHelpers';
