import {
  attachPickerHtml,
  parsePickerMessage,
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
    const html = attachPickerHtml();
    expect(html).toContain('type="file"');
    expect(html).toContain('multiple');
    expect(html).toContain(
      'accept="image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf"',
    );
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('reads only the messages the page sends', () => {
    expect(parsePickerMessage('{"type":"start","count":2}')).toEqual({ type: 'start', count: 2 });
    expect(parsePickerMessage('{"type":"done"}')).toEqual({ type: 'done' });
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
