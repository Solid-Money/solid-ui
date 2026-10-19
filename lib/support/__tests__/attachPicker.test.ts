import {
  attachPickerHtml,
  parsePickerMessage,
  pickedLimit,
  pickedMime,
  pickedName,
  supportFileFromPicker,
} from '@/lib/support/attachPicker';

jest.mock('@/lib/support/sync', () => ({
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  MAX_PDF_BYTES: 20 * 1024 * 1024,
}));

describe('attach picker (iOS and Android)', () => {
  it('offers photos and PDFs, several at once, with no outside links', () => {
    const html = attachPickerHtml(5);
    expect(html).toContain('type="file"');
    expect(html).toContain('multiple');
    expect(html).toContain(
      'accept="image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf"',
    );
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('reads only the messages the page sends', () => {
    expect(parsePickerMessage('{"type":"start","count":2}')).toEqual({ type: 'start', count: 2 });
    expect(parsePickerMessage('{"type":"done"}')).toEqual({ type: 'done', left: 0 });
    expect(parsePickerMessage('{"type":"done","left":3}')).toEqual({ type: 'done', left: 3 });
    expect(parsePickerMessage('{"type":"done","left":-2}')).toEqual({ type: 'done', left: 0 });
    expect(
      parsePickerMessage(
        '{"type":"file","name":"a.jpg","mime":"image/jpeg","size":3,"data":"QUJD"}',
      ),
    ).toEqual({ type: 'file', name: 'a.jpg', mime: 'image/jpeg', size: 3, data: 'QUJD' });
    expect(parsePickerMessage('{"type":"file","name":"a.pdf","size":3,"data":null}')).toMatchObject(
      {
        mime: '',
        data: null,
      },
    );
    expect(parsePickerMessage('{"type":"file","name":"a.pdf"}')).toBeNull();
    expect(parsePickerMessage('{"type":"navigate"}')).toBeNull();
    expect(parsePickerMessage('not json')).toBeNull();
  });

  it('fills in a blank type and name', () => {
    expect(pickedMime('Scan.PDF', '')).toBe('application/pdf');
    expect(pickedMime('x', 'IMAGE/JPEG')).toBe('image/jpeg');
    expect(pickedMime('notes.txt', '')).toBe('');
    expect(pickedName('/private/var/tmp/IMG_1.jpeg', 'image/jpeg')).toBe('IMG_1.jpeg');
    expect(pickedName('', 'application/pdf')).toBe('document.pdf');
    expect(pickedName('  ', 'image/png')).toBe('photo.jpg');
  });

  it('saves the bytes and hands the composer a file it can upload', () => {
    const save = jest.fn(() => 'file:///cache/support-1-IMG_1.jpeg');
    expect(
      supportFileFromPicker(
        { type: 'file', name: 'IMG_1.jpeg', mime: 'image/jpeg', size: 3, data: 'QUJD' },
        save,
      ),
    ).toEqual({
      name: 'IMG_1.jpeg',
      mime: 'image/jpeg',
      size: 3,
      uri: 'file:///cache/support-1-IMG_1.jpeg',
    });
    expect(save).toHaveBeenCalledWith('IMG_1.jpeg', 'QUJD');
  });

  it('reads no more files than the message has room for, and photos only up to 10 MB', () => {
    const html = attachPickerHtml(2);
    expect(html).toContain('var room = 2;');
    // The limit is chosen per file: 20 MB for a PDF (also by name), 10 MB otherwise.
    expect(html).toContain(`return pdf ? ${20 * 1024 * 1024} : ${10 * 1024 * 1024};`);
    expect(html).toContain('/\\.pdf$/i');
    expect(html).toContain('if (room <= 0) { left += 1; return; }');
    // An empty file, or one read as nothing, is reported, never attached.
    expect(html).toContain("if (!file.size) { post({ type: 'error', name: name }); return; }");
    expect(html).toContain('if (!data) { failed(); return; }');
    expect(attachPickerHtml(-1)).toContain('var room = 0;');
  });

  it('runs: reads the first files that fit, skips the rest, and never reads an oversized photo', async () => {
    const posted: Record<string, unknown>[] = [];
    const html = attachPickerHtml(1);
    const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    const handlers: Record<string, () => void> = {};
    const input = {
      files: [] as { name: string; type: string; size: number }[],
      value: 'x',
      addEventListener: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    };
    const reads: string[] = [];
    class FakeReader {
      result = '';
      onload: () => void = () => undefined;
      onerror: () => void = () => undefined;
      error = null;
      readAsDataURL(file: { name: string }) {
        reads.push(file.name);
        this.result = 'data:x;base64,QUJD';
        setTimeout(() => this.onload(), 0);
      }
    }

    new Function('document', 'window', 'FileReader', script)(
      { getElementById: () => input },
      { ReactNativeWebView: { postMessage: (raw: string) => posted.push(JSON.parse(raw)) } },
      FakeReader,
    );
    input.files = [
      { name: 'big.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 },
      { name: 'empty.png', type: 'image/png', size: 0 },
      { name: 'a.pdf', type: '', size: 15 * 1024 * 1024 },
      { name: 'b.png', type: 'image/png', size: 3 },
      { name: 'c.png', type: 'image/png', size: 3 },
    ];
    handlers.change();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(reads).toEqual(['a.pdf']);
    expect(posted).toEqual([
      { type: 'start', count: 5 },
      { type: 'file', name: 'big.jpg', mime: 'image/jpeg', size: 11 * 1024 * 1024, data: null },
      { type: 'error', name: 'empty.png' },
      { type: 'file', name: 'a.pdf', mime: '', size: 15 * 1024 * 1024, data: 'QUJD' },
      { type: 'done', left: 2 },
    ]);
  });

  it('gives a slot back when a file cannot be read', async () => {
    const posted: Record<string, unknown>[] = [];
    const html = attachPickerHtml(1);
    const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    const handlers: Record<string, () => void> = {};
    const input = {
      files: [] as { name: string; type: string; size: number }[],
      value: 'x',
      addEventListener: (event: string, handler: () => void) => {
        handlers[event] = handler;
      },
    };
    class FakeReader {
      result = '';
      onload: () => void = () => undefined;
      onerror: () => void = () => undefined;
      error = new Error('unreadable');
      readAsDataURL(file: { name: string }) {
        if (file.name === 'broken.png') {
          setTimeout(() => this.onerror(), 0);
          return;
        }
        this.result = 'data:x;base64,QUJD';
        setTimeout(() => this.onload(), 0);
      }
    }
    new Function('document', 'window', 'FileReader', script)(
      { getElementById: () => input },
      { ReactNativeWebView: { postMessage: (raw: string) => posted.push(JSON.parse(raw)) } },
      FakeReader,
    );
    input.files = [
      { name: 'broken.png', type: 'image/png', size: 3 },
      { name: 'ok.png', type: 'image/png', size: 3 },
    ];
    handlers.change();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(posted).toEqual([
      { type: 'start', count: 2 },
      { type: 'error', name: 'broken.png' },
      { type: 'file', name: 'ok.png', mime: 'image/png', size: 3, data: 'QUJD' },
      { type: 'done', left: 0 },
    ]);
  });

  it('turns away a small file with no bytes as unreadable', () => {
    expect(() =>
      supportFileFromPicker(
        { type: 'file', name: 'empty.png', mime: 'image/png', size: 0, data: null },
        jest.fn(),
      ),
    ).toThrow('could not be read');
    expect(pickedLimit('application/pdf')).toBe(20 * 1024 * 1024);
    expect(pickedLimit('image/heic')).toBe(10 * 1024 * 1024);
  });

  it('passes a file too big to read on without bytes, for the composer to explain', () => {
    const save = jest.fn();
    expect(
      supportFileFromPicker(
        { type: 'file', name: 'huge.pdf', mime: 'application/pdf', size: 50e6, data: null },
        save,
      ),
    ).toEqual({ name: 'huge.pdf', mime: 'application/pdf', size: 50e6 });
    expect(save).not.toHaveBeenCalled();
  });
});
