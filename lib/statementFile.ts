// Platform-specific resolution target for TypeScript.
// Metro bundles lib/statementFile.native.ts on native and lib/statementFile.web.ts on web.
// This file exists so TypeScript can resolve '@/lib/statementFile' during type checking.
export type { SaveStatementResult } from './statementFile.types';
export { saveStatementFile } from './statementFile.web';
