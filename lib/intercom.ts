// Platform-specific resolution target for TypeScript.
// Metro bundles lib/intercom.native.ts on native and lib/intercom.web.ts on web.
// This file exists so TypeScript can resolve '@/lib/intercom' during type checking.
export { openIntercom, useIntercom } from './intercom.web';
