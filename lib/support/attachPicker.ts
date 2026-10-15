import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from '@/lib/support/sync';

import type { SupportFile } from '@/lib/types/support';

/**
 * The app's attach button on iOS and Android, until the native photo and
 * file pickers ship in a store build: a tiny page in the in-app web view
 * (already in every build) with a file input. Tapping it opens the phone's
 * own menu (Photo Library, Take Photo, Choose File); the page reads what was
 * picked and posts it back, one message per file. Plain JavaScript in an
 * existing native module, so it goes out as an over-the-air update.
 */

/** What the picker page posts back. */
export type PickerMessage =
  | { type: 'start'; count: number }
  | { type: 'file'; name: string; mime: string; size: number; data: string | null }
  | { type: 'error'; name: string }
  | { type: 'done' };

/** Files over this are not read at all; the composer explains the limit. */
const READ_LIMIT = Math.max(MAX_IMAGE_BYTES, MAX_PDF_BYTES);

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf';

// lucide "paperclip", the icon the web composer shows.
const PAPERCLIP =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>';

/** The picker page: a round paperclip that fills the web view. */
export const attachPickerHtml = (): string => `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
label{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%}
label:active{background:rgba(255,255,255,.1)}
input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
</style></head><body>
<label aria-label="Attach a photo or PDF" role="button"><input id="f" type="file" accept="${ACCEPT}" multiple>${PAPERCLIP}</label>
<script>
(function(){
  var input = document.getElementById('f');
  function post(message){ window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  function read(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){ var url = String(reader.result); resolve(url.slice(url.indexOf(',') + 1)); };
      reader.onerror = function(){ reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }
  input.addEventListener('change', function(){
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    post({ type: 'start', count: files.length });
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){
        var base = { type: 'file', name: file.name || '', mime: file.type || '', size: file.size };
        if (file.size > ${READ_LIMIT}) { base.data = null; post(base); return; }
        return read(file).then(function(data){ base.data = data; post(base); },
          function(){ post({ type: 'error', name: file.name || '' }); });
      });
    });
    chain.then(function(){ post({ type: 'done' }); });
  });
})();
</script></body></html>`;

/** A message from the page, or null for anything else. */
export const parsePickerMessage = (raw: string): PickerMessage | null => {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'start':
      return { type: 'start', count: Number(message.count) || 0 };
    case 'done':
      return { type: 'done' };
    case 'error':
      return { type: 'error', name: String(message.name ?? '') };
    case 'file':
      if (typeof message.size !== 'number') return null;
      return {
        type: 'file',
        name: String(message.name ?? ''),
        mime: String(message.mime ?? ''),
        size: message.size,
        data: typeof message.data === 'string' && message.data ? message.data : null,
      };
    default:
      return null;
  }
};

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

/** Saves the picked bytes where the uploader can read them; returns a file:// uri. */
export type SaveBase64 = (name: string, base64: string) => string;

/**
 * The composer's file for one picked file. Without bytes (over the size
 * limit) it has no uri: the composer turns it away with the reason.
 */
export const supportFileFromPicker = (
  message: Extract<PickerMessage, { type: 'file' }>,
  save: SaveBase64,
): SupportFile => {
  const mime = pickedMime(message.name, message.mime);
  const name = pickedName(message.name, mime);
  const file: SupportFile = { name, mime, size: message.size };
  if (message.data) file.uri = save(name, message.data);
  return file;
};
