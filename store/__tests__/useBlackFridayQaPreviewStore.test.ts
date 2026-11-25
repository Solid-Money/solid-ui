import {
  syncBlackFridayQaPreview,
  useBlackFridayQaPreviewStore,
} from '@/store/useBlackFridayQaPreviewStore';

const QA_ORIGIN = 'https://app-qa.solid.xyz';
const previewEnabled = () => useBlackFridayQaPreviewStore.getState().enabled;

const createSessionStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
};

beforeEach(() => useBlackFridayQaPreviewStore.setState({ enabled: false }));

it('requires an opt-in and remembers it across navigation and a reload', () => {
  const browser = {
    location: { origin: QA_ORIGIN, search: '' },
    sessionStorage: createSessionStorage(),
  };
  syncBlackFridayQaPreview(browser);
  expect(previewEnabled()).toBe(false);

  browser.location.search = '?blackFridayPreview=1';
  syncBlackFridayQaPreview(browser);
  expect(previewEnabled()).toBe(true);

  browser.location.search = '';
  useBlackFridayQaPreviewStore.setState({ enabled: false });
  syncBlackFridayQaPreview(browser);
  expect(previewEnabled()).toBe(true);

  syncBlackFridayQaPreview({ ...browser, sessionStorage: createSessionStorage() });
  expect(previewEnabled()).toBe(false);
});

it('clears the tab preview when the link opts out', () => {
  const browser = {
    location: { origin: QA_ORIGIN, search: '' },
    sessionStorage: createSessionStorage(),
  };
  syncBlackFridayQaPreview(browser, '1');
  expect(previewEnabled()).toBe(true);
  syncBlackFridayQaPreview(browser, '0');
  syncBlackFridayQaPreview(browser);
  expect(previewEnabled()).toBe(false);
});

it.each([
  'https://app.solid.xyz',
  'https://app-qa.solid.xyz.example.com',
  'http://app-qa.solid.xyz',
])('ignores preview links on %s', origin => {
  const sessionStorage = createSessionStorage();
  syncBlackFridayQaPreview({
    location: { origin, search: '?blackFridayPreview=1' },
    sessionStorage,
  });
  expect(previewEnabled()).toBe(false);
  expect(sessionStorage.getItem('blackFridayPreview')).toBeNull();
});

it('keeps the choice in memory when browser storage is blocked', () => {
  const browser = {
    location: { origin: QA_ORIGIN, search: '' },
    get sessionStorage(): never {
      throw new Error('Storage blocked');
    },
  };
  syncBlackFridayQaPreview(browser, '1');
  syncBlackFridayQaPreview(browser);
  expect(previewEnabled()).toBe(true);
  syncBlackFridayQaPreview(browser, '0');
  expect(previewEnabled()).toBe(false);
});
