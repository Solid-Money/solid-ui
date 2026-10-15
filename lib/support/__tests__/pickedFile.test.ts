import { pickedMime, pickedName } from '@/lib/support/pickedFile';

describe('picked files', () => {
  it('fills in a blank type from the name', () => {
    expect(pickedMime('Scan.PDF', '')).toBe('application/pdf');
    expect(pickedMime('x', 'IMAGE/JPEG')).toBe('image/jpeg');
    expect(pickedMime('notes.txt', '')).toBe('');
  });

  it('keeps just the file name, or names it', () => {
    expect(pickedName('/private/var/tmp/IMG_1.jpeg', 'image/jpeg')).toBe('IMG_1.jpeg');
    expect(pickedName('', 'application/pdf')).toBe('document.pdf');
    expect(pickedName('  ', 'image/png')).toBe('photo.jpg');
  });
});
