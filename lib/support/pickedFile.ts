/** Type and name for a file picked on the phone, as the support upload needs them. */

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
};

/** The file's type; some Android pickers leave it blank, so then from its name. */
export const pickedMime = (name: string, mime: string): string => {
  if (mime) return mime.toLowerCase();
  const extension = name.toLowerCase().split('.').pop() ?? '';
  return MIME_BY_EXTENSION[extension] ?? '';
};

/** A name to show and send: no folders, not empty, not huge. */
export const pickedName = (name: string, mime: string): string => {
  const base = (name.split(/[\\/]/).pop() ?? '').trim().slice(-120);
  if (base) return base;
  return mime === 'application/pdf' ? 'document.pdf' : 'photo.jpg';
};
