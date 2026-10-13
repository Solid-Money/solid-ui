import { SaveStatementFile } from '@/lib/statementFile.types';

// This file is only loaded on web via Metro platform resolution (.web.ts).

/** Saves a statement CSV through the browser's own download. */
export const saveStatementFile: SaveStatementFile = async ({ filename, content }) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Revoked on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return 'saved';
};
