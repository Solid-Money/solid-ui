import { create } from 'zustand';

const QA_ORIGIN = 'https://app-qa.solid.xyz';
const PREVIEW_PARAM = 'blackFridayPreview';

type PreviewBrowser = {
  location: Pick<Location, 'origin' | 'search'>;
  sessionStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
};

export const useBlackFridayQaPreviewStore = create<{ enabled: boolean }>(() => ({
  enabled: false,
}));

/** Keep the web preview in this tab through navigation, sign-in and reloads. */
export function syncBlackFridayQaPreview(browser: PreviewBrowser, routeParam?: string | string[]) {
  if (browser.location.origin !== QA_ORIGIN) return;

  const value = routeParam ?? new URLSearchParams(browser.location.search).get(PREVIEW_PARAM);
  const optIn = value === '1';
  const optOut = value === '0';
  let enabled = optIn || (!optOut && useBlackFridayQaPreviewStore.getState().enabled);

  try {
    const storage = browser.sessionStorage;
    if (optIn) storage.setItem(PREVIEW_PARAM, '1');
    else if (optOut) storage.removeItem(PREVIEW_PARAM);
    else enabled = storage.getItem(PREVIEW_PARAM) === '1';
  } catch {
    // Browsers can block storage. The explicit choice still works until reload.
  }

  useBlackFridayQaPreviewStore.setState({ enabled });
}
