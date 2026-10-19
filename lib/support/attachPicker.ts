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
  /** `left`: files not read because the message had no room left for them. */
  | { type: 'done'; left: number };

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf';

// lucide "paperclip", the icon the web composer shows.
const PAPERCLIP =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 6-8.414 8.586a2 2 0 0 0 2.829 2.829l8.414-8.586a4 4 0 1 0-5.657-5.657l-8.379 8.551a6 6 0 1 0 8.485 8.485l8.379-8.551"/></svg>';

/**
 * The picker page: a round paperclip that fills the web view.
 *
 * `room` is how many more files the message can take. The page reads at most
 * that many and only counts the rest, so a big selection never fills the
 * cache with files the composer would turn away. A file over its own limit
 * (10 MB for a photo, 20 MB for a PDF) is not read either: it is passed on
 * without bytes, and the composer says why. An empty file is reported as one
 * that could not be read.
 */
export const attachPickerHtml = (room: number): string => `<!doctype html>
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
  function limit(file){
    var type = (file.type || '').toLowerCase();
    var pdf = type === 'application/pdf' || (!type && /\\.pdf$/i.test(file.name || ''));
    return pdf ? ${MAX_PDF_BYTES} : ${MAX_IMAGE_BYTES};
  }
  input.addEventListener('change', function(){
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    post({ type: 'start', count: files.length });
    var room = ${Math.max(0, Math.floor(room))};
    var left = 0;
    var chain = Promise.resolve();
    files.forEach(function(file){
      chain = chain.then(function(){
        var name = file.name || '';
        var base = { type: 'file', name: name, mime: file.type || '', size: file.size };
        if (file.size > limit(file)) { base.data = null; post(base); return; }
        if (!file.size) { post({ type: 'error', name: name }); return; }
        if (room <= 0) { left += 1; return; }
        room -= 1;
        return read(file).then(function(data){
          if (!data) { post({ type: 'error', name: name }); return; }
          base.data = data; post(base);
        }, function(){ post({ type: 'error', name: name }); });
      });
    });
    chain.then(function(){ post({ type: 'done', left: left }); });
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
      return { type: 'done', left: Math.max(0, Math.floor(Number(message.left) || 0)) };
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

/** The most this file may weigh: 20 MB for a PDF, 10 MB for a photo. */
export const pickedLimit = (mime: string): number =>
  mime === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;

/**
 * The composer's file for one picked file. Without bytes because it is over
 * its limit, it has no uri: the composer turns it away with the reason. Without
 * bytes for any other reason it could not be read, and this throws.
 */
export const supportFileFromPicker = (
  message: Extract<PickerMessage, { type: 'file' }>,
  save: SaveBase64,
): SupportFile => {
  const mime = pickedMime(message.name, message.mime);
  const name = pickedName(message.name, mime);
  const file: SupportFile = { name, mime, size: message.size };
  if (message.data) file.uri = save(name, message.data);
  else if (message.size <= pickedLimit(mime)) throw new Error(`${name} could not be read`);
  return file;
};
