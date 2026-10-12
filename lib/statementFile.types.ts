import { StatementDownload } from '@/lib/types';

/**
 * What became of a statement handed to the user:
 * - `shared`: the iOS share sheet took it (Save to Files, Mail, AirDrop…).
 * - `saved`: written where the user chose — an Android folder, or the web's downloads.
 * - `cancelled`: the user closed the picker or the sheet without choosing.
 */
export type SaveStatementResult = 'shared' | 'saved' | 'cancelled';

export type SaveStatementFile = (file: StatementDownload) => Promise<SaveStatementResult>;
