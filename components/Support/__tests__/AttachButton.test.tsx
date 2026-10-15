import React from 'react';
import Toast from 'react-native-toast-message';

import AttachButton, { attachAvailable } from '@/components/Support/AttachButton';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer');

jest.mock('react-native-toast-message', () => ({ show: jest.fn() }));

jest.mock('@/lib/support/sync', () => ({
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  MAX_PDF_BYTES: 20 * 1024 * 1024,
}));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));

const written: { uri: string; content: string; encoding?: string }[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  File: class {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }
    create() {}
    write(content: string, options?: { encoding?: string }) {
      written.push({ uri: this.uri, content, encoding: options?.encoding });
    }
  },
}));

const send = (
  renderer: { root: { findByType: (type: string) => { props: Record<string, unknown> } } },
  message: object,
) =>
  act(() => {
    const onMessage = renderer.root.findByType('WebView').props.onMessage as (
      event: object,
    ) => void;
    onMessage({ nativeEvent: { data: JSON.stringify(message) } });
  });

describe('AttachButton (iOS and Android)', () => {
  beforeEach(() => {
    written.length = 0;
    jest.clearAllMocks();
  });

  it('is shown in the app', () => {
    expect(attachAvailable).toBe(true);
  });

  it('hands over every picked file at once, saved for the upload', () => {
    const onPick = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AttachButton onPick={onPick} />);
    });
    send(renderer!, { type: 'start', count: 2 });
    send(renderer!, {
      type: 'file',
      name: 'IMG 1.jpeg',
      mime: 'image/jpeg',
      size: 3,
      data: 'QUJD',
    });
    send(renderer!, {
      type: 'file',
      name: 'Statement.pdf',
      mime: 'application/pdf',
      size: 4,
      data: 'QUJDRA==',
    });
    expect(onPick).not.toHaveBeenCalled();
    send(renderer!, { type: 'done' });

    expect(onPick).toHaveBeenCalledTimes(1);
    const [files] = onPick.mock.calls[0];
    expect(files.map((file: { name: string }) => file.name)).toEqual([
      'IMG 1.jpeg',
      'Statement.pdf',
    ]);
    expect(files[0].uri).toMatch(/^file:\/\/\/cache\/support-\d+-[a-z0-9]+-IMG_1\.jpeg$/);
    expect(written.map(entry => [entry.content, entry.encoding])).toEqual([
      ['QUJD', 'base64'],
      ['QUJDRA==', 'base64'],
    ]);
  });

  it('says so when a file could not be read, and still hands over the rest', () => {
    const onPick = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AttachButton onPick={onPick} />);
    });
    send(renderer!, { type: 'start', count: 2 });
    send(renderer!, { type: 'error', name: 'broken.pdf' });
    send(renderer!, { type: 'file', name: 'a.png', mime: 'image/png', size: 3, data: 'QUJD' });
    send(renderer!, { type: 'done' });
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text1: "Couldn't attach broken.pdf" }),
    );
    expect(onPick.mock.calls[0][0]).toHaveLength(1);
  });

  it('cannot be tapped while disabled', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(<AttachButton disabled onPick={jest.fn()} />);
    });
    const box = renderer!.root.findByType('WebView').parent;
    expect(box.props.pointerEvents).toBe('none');
  });
});
