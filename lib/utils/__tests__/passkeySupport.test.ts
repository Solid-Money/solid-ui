/// <reference types="jest" />
import {
  BrowserEnvironment,
  buildOpenInBrowserUrl,
  getDevicePlatform,
  getInAppBrowserName,
  getPasskeyBlock,
  isIosInAppBrowser,
} from '@/lib/utils/passkeySupport';

const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SAFARI_IPAD_DESKTOP_SITE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const BARE_WKWEBVIEW =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const GOOGLE_APP_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/437.4.973319807 Mobile/15E148 Safari/604.1';
const INSTAGRAM_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.88 (iPhone15,3; iOS 18_6; en_US; en; scale=3.00; 1290x2796; 761530423)';

const env = (
  userAgent: string,
  overrides: Partial<BrowserEnvironment> = {},
): BrowserEnvironment => ({
  userAgent,
  isSecureContext: true,
  isTopLevel: true,
  hasWebAuthn: true,
  isStandalone: false,
  hasTouch: /iPhone|iPad|Android/.test(userAgent),
  ...overrides,
});

/**
 * Every browser family that created a passkey on web in the 180 days to
 * 2026-10-06 (Amplitude, "Passkey Added" by OS), plus the iOS browsers that
 * share WebKit with Safari. Blocking any of these is the false positive the
 * removed `isWebView` check had, so each one is pinned here.
 */
const MUST_NEVER_BLOCK: [string, string, Partial<BrowserEnvironment>][] = (
  [
    // iOS
    ['Safari, iOS 17', SAFARI_IOS],
    [
      'Safari, iOS 26 (OS version frozen at 18_6)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    ],
    [
      'Chrome, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
    ],
    [
      'Firefox, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'Edge, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/140.0.3485.94 Mobile/15E148 Safari/605.1.15',
    ],
    [
      'DuckDuckGo, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15',
    ],
    [
      'Opera, iOS',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 OPT/5.4.0',
    ],
    ['Safari, iPad asking for the desktop site', SAFARI_IPAD_DESKTOP_SITE, { hasTouch: true }],
    ['Home Screen web app (WebKit drops the Safari token)', BARE_WKWEBVIEW, { isStandalone: true }],
    // Android
    ['Chrome, Android', CHROME_ANDROID],
    [
      'Samsung Internet',
      'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/136.0.0.0 Mobile Safari/537.36',
    ],
    ['Firefox, Android', 'Mozilla/5.0 (Android 14; Mobile; rv:143.0) Gecko/143.0 Firefox/143.0'],
    [
      'Edge, Android',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 EdgA/140.0.3485.94',
    ],
    [
      'Opera, Android',
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 OPR/91.0.0.0',
    ],
    [
      'MIUI Browser',
      'Mozilla/5.0 (Linux; U; Android 14; en-us; 23078PND5G Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile Safari/537.36 XiaoMi/MiuiBrowser/20.11.5000119-gn',
    ],
    [
      'Huawei Browser',
      'Mozilla/5.0 (Linux; Android 12; HarmonyOS; NOH-AN00; HMSCore 6.13.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.196 HuaweiBrowser/17.0.6.313 Mobile Safari/537.36',
    ],
    [
      'Android Browser',
      'Mozilla/5.0 (Linux; U; Android 13; en-us; SM-A135F Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Mobile Safari/537.36',
    ],
    [
      'an Android WebView whose app turned WebAuthn on',
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36',
    ],
    // Desktop
    [
      'Chrome, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ],
    ['Chrome, macOS', CHROME_MAC],
    [
      'Safari, macOS',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
    ],
    [
      'Edge, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
    ],
    [
      'Firefox, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
    ],
    [
      'Opera, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 OPR/124.0.0.0',
    ],
    [
      'Yandex, Windows',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 YaBrowser/25.8.0.0 Safari/537.36',
    ],
    [
      'Brave, Linux',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ],
  ] as [string, string, Partial<BrowserEnvironment>?][]
).map(([label, userAgent, overrides]): [string, string, Partial<BrowserEnvironment>] => [
  label,
  userAgent,
  overrides ?? {},
]);

/** Built-in browsers of iOS apps: WKWebView without passkey rights for solid.xyz. */
const IOS_IN_APP: [string, string, string | null][] = [
  ['a bare WKWebView (apps that add nothing to the user agent)', BARE_WKWEBVIEW, null],
  ['Instagram', INSTAGRAM_IOS, 'Instagram'],
  [
    'Facebook',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/577.0.0.49.89;FBBV/814452001;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/80]',
    'Facebook',
  ],
  [
    'Messenger',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/520.0.0.30.106;FBBV/770101207;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.6;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]',
    'Messenger',
  ],
  [
    'TikTok',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_40.6.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US',
    'TikTok',
  ],
  [
    'LinkedIn',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1234',
    'LinkedIn',
  ],
  [
    'WeChat',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322d) NetType/WIFI Language/zh_CN',
    'WeChat',
  ],
  ['the Google app (adds a Safari token, still a WKWebView)', GOOGLE_APP_IOS, 'Google'],
];

describe('getPasskeyBlock', () => {
  it.each(MUST_NEVER_BLOCK)('lets %s through', (_label, userAgent, overrides) => {
    expect(getPasskeyBlock(env(userAgent, overrides))).toBeNull();
  });

  it.each(IOS_IN_APP)('blocks the in-app browser of %s', (_label, userAgent, app) => {
    expect(getPasskeyBlock(env(userAgent))).toEqual({
      reason: 'in_app_browser',
      platform: 'ios',
      app,
      inAppBrowser: true,
    });
  });

  it('blocks an iPad in-app browser that sends a Mac user agent', () => {
    const ipadWebView =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
    expect(getPasskeyBlock(env(ipadWebView, { hasTouch: true }))?.reason).toBe('in_app_browser');
    // The same user agent without touch is a Mac app's web view: not iOS, not blocked.
    expect(getPasskeyBlock(env(ipadWebView, { hasTouch: false }))).toBeNull();
  });

  it('blocks a browser without the WebAuthn API, and says when it is an in-app one', () => {
    const facebookAndroid =
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/577.0.0.49.89;]';
    expect(getPasskeyBlock(env(facebookAndroid, { hasWebAuthn: false }))).toEqual({
      reason: 'no_webauthn',
      platform: 'android',
      app: 'Facebook',
      inAppBrowser: true,
    });

    const plainWebView =
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36';
    expect(getPasskeyBlock(env(plainWebView, { hasWebAuthn: false }))).toMatchObject({
      reason: 'no_webauthn',
      inAppBrowser: true,
    });

    const oldDesktop = 'Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko';
    expect(getPasskeyBlock(env(oldDesktop, { hasWebAuthn: false }))).toEqual({
      reason: 'no_webauthn',
      platform: 'other',
      app: null,
      inAppBrowser: false,
    });
  });

  it('blocks outside a secure context and inside a frame', () => {
    expect(getPasskeyBlock(env(CHROME_MAC, { isSecureContext: false }))?.reason).toBe(
      'insecure_context',
    );
    expect(getPasskeyBlock(env(CHROME_MAC, { isTopLevel: false }))?.reason).toBe('in_frame');
  });

  it('never blocks Android on the user agent alone', () => {
    const instagramAndroid =
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Instagram 389.0.0.29.88 Android (34/14; 480dpi; 1080x2340; samsung; SM-S918B; dm3q; qcom; en_US; 761530423)';
    expect(getPasskeyBlock(env(instagramAndroid))).toBeNull();
  });
});

describe('isIosInAppBrowser', () => {
  it('treats a Home Screen web app as Safari, but never the Google app', () => {
    expect(
      isIosInAppBrowser({ userAgent: BARE_WKWEBVIEW, isStandalone: true, hasTouch: true }),
    ).toBe(false);
    expect(
      isIosInAppBrowser({ userAgent: BARE_WKWEBVIEW, isStandalone: false, hasTouch: true }),
    ).toBe(true);
    expect(
      isIosInAppBrowser({ userAgent: GOOGLE_APP_IOS, isStandalone: true, hasTouch: true }),
    ).toBe(true);
  });
});

describe('getInAppBrowserName', () => {
  it('names apps that announce themselves, on either platform', () => {
    expect(getInAppBrowserName(INSTAGRAM_IOS)).toBe('Instagram');
    expect(
      getInAppBrowserName(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Telegram-Android/11.14.1 (Google Pixel 8; Android 14; SDK 34; HIGH)',
      ),
    ).toBe('Telegram');
    expect(getInAppBrowserName(SAFARI_IOS)).toBeNull();
  });
});

describe('getDevicePlatform', () => {
  it('reads iOS, iPadOS, Android and everything else', () => {
    expect(getDevicePlatform(SAFARI_IOS)).toBe('ios');
    expect(getDevicePlatform(SAFARI_IPAD_DESKTOP_SITE, true)).toBe('ios');
    expect(getDevicePlatform(SAFARI_IPAD_DESKTOP_SITE, false)).toBe('other');
    expect(getDevicePlatform(CHROME_ANDROID)).toBe('android');
    expect(getDevicePlatform(CHROME_MAC)).toBe('other');
  });
});

describe('buildOpenInBrowserUrl', () => {
  const origin = 'https://app.solid.xyz';

  it('keeps the path and query, which carry the referral code', () => {
    expect(buildOpenInBrowserUrl(origin, '/?ref=H1P3Y&utm_source=website')).toBe(
      'https://app.solid.xyz/?ref=H1P3Y&utm_source=website',
    );
    expect(buildOpenInBrowserUrl(origin, '/signup/email')).toBe(
      'https://app.solid.xyz/signup/email',
    );
  });

  it('never points anywhere but this site', () => {
    for (const from of ['//evil.example/x', 'https://evil.example', '/\\evil.example', '', null]) {
      expect(buildOpenInBrowserUrl(origin, from)).toBe('https://app.solid.xyz/');
    }
  });
});
