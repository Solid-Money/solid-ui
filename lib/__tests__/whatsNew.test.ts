import {
  canShowWhatsNew,
  carouselLayout,
  isSingleWhatsNew,
  singleLeadImageUrl,
  singleMediaSize,
  slideCta,
  whatsNewEventBase,
  whatsNewViewedProps,
} from '@/lib/whatsNew';

import type { WhatsNew, WhatsNewMedia } from '@/lib/types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const STEP = {
  imageUrl: 'https://cdn.test/step.png',
  title: 'Euro cards are here',
  text: 'Pay 0 fees.',
};

const IMAGE: WhatsNewMedia = {
  type: 'image',
  url: 'https://cdn.test/new.webp',
  width: 1080,
  height: 1350,
  alt: 'Euro cards are here',
};

const VIDEO: WhatsNewMedia = {
  type: 'video',
  url: 'https://cdn.test/new.mp4',
  width: 1080,
  height: 1350,
  alt: 'Swap in two taps',
  posterUrl: 'https://cdn.test/new-poster.jpg',
  hasAudio: true,
};

const popup = (over: Partial<WhatsNew>): WhatsNew => ({
  _id: 'popup-1',
  steps: [],
  isActive: true,
  showOnLoad: true,
  createdAt: '2026-11-04T00:00:00.000Z',
  ...over,
});

const single = (over: Partial<WhatsNew> = {}) =>
  popup({ format: 'single', presentation: 'drawer', media: IMAGE, name: 'Swap v1', ...over });

describe("What's New formats", () => {
  it('treats a popup saved before format existed as a carousel', () => {
    expect(canShowWhatsNew(popup({ steps: [STEP] }))).toBe(true);
    expect(canShowWhatsNew(popup({ format: 'carousel', steps: [STEP] }))).toBe(true);
  });

  it('skips a carousel with no steps', () => {
    expect(canShowWhatsNew(popup({ steps: [] }))).toBe(false);
  });

  it('draws a single image or a video with a poster', () => {
    expect(isSingleWhatsNew(single())).toBe(true);
    expect(isSingleWhatsNew(single({ presentation: 'popup', media: VIDEO }))).toBe(true);
  });

  it("refuses a single it couldn't draw whole", () => {
    expect(isSingleWhatsNew(single({ media: undefined }))).toBe(false);
    expect(isSingleWhatsNew(single({ presentation: undefined }))).toBe(false);
    expect(isSingleWhatsNew(single({ media: { ...VIDEO, posterUrl: '' } }))).toBe(false);
    expect(isSingleWhatsNew(single({ media: { ...IMAGE, width: 0 } }))).toBe(false);
    expect(isSingleWhatsNew(single({ media: { ...IMAGE, url: ' ' } }))).toBe(false);
  });

  it('skips a format added after this build', () => {
    expect(canShowWhatsNew(popup({ format: 'story' as never, steps: [STEP] }))).toBe(false);
  });

  it('waits on the image, or the video poster rather than the video', () => {
    const image = single();
    const video = single({ media: VIDEO });
    if (!isSingleWhatsNew(image) || !isSingleWhatsNew(video)) throw new Error('not single');
    expect(singleLeadImageUrl(image)).toBe(IMAGE.url);
    expect(singleLeadImageUrl(video)).toBe(VIDEO.posterUrl);
  });
});

describe("What's New size", () => {
  const phone = { width: 390, height: 844 };

  it('leaves 16pt either side of a phone popup', () => {
    expect(singleMediaSize(phone, IMAGE, 'popup')).toEqual({ width: 358, height: 447.5 });
  });

  it('never draws a popup wider than 440', () => {
    expect(singleMediaSize({ width: 1440, height: 900 }, IMAGE, 'popup').width).toBe(440);
  });

  it('scales a tall popup down to 85% of the screen height', () => {
    const size = singleMediaSize(phone, { width: 1080, height: 2400 }, 'popup');
    expect(size.height).toBeCloseTo(844 * 0.85);
    expect(size.width).toBeLessThan(358);
  });

  it('draws a drawer full width, at most 90% of the screen high', () => {
    expect(singleMediaSize(phone, IMAGE, 'drawer').width).toBe(390);
    const tall = singleMediaSize({ width: 390, height: 500 }, IMAGE, 'drawer');
    expect(tall.height).toBeCloseTo(450);
  });
});

describe("What's New analytics", () => {
  it('names a single by its admin name and a carousel by step 1', () => {
    expect(whatsNewEventBase(single())).toEqual({ id: 'popup-1', name: 'Swap v1' });
    expect(whatsNewEventBase(popup({ steps: [STEP] }))).toEqual({
      id: 'popup-1',
      name: 'Euro cards are here',
    });
  });

  it('describes what was viewed', () => {
    expect(whatsNewViewedProps(single({ media: VIDEO }), 'popup')).toMatchObject({
      id: 'popup-1',
      name: 'Swap v1',
      format: 'single',
      presentation: 'popup',
      media_type: 'video',
    });
    expect(whatsNewViewedProps(popup({ steps: [STEP, STEP] }), 'popup')).toMatchObject({
      format: 'carousel',
      media_type: 'image',
      steps: 2,
    });
  });
});

describe("What's New carousel layout", () => {
  it('matches the phone design: 16pt margins, 17pt padding, 5:4 media', () => {
    expect(carouselLayout({ width: 393, height: 852 }, false)).toEqual({
      cardWidth: 361,
      padding: 17,
      pageWidth: 327,
      mediaHeight: 261.6,
      textInset: 0,
    });
  });

  it('matches the desktop design: 640 card, 26pt padding, 16:9 media', () => {
    const layout = carouselLayout({ width: 1440, height: 900 }, true);
    expect(layout).toMatchObject({ cardWidth: 640, padding: 26, pageWidth: 588, textInset: 16 });
    expect(layout.mediaHeight).toBeCloseTo(330.75);
  });

  it('gives up media height on short screens', () => {
    expect(carouselLayout({ width: 375, height: 600 }, false).mediaHeight).toBeCloseTo(216);
    expect(carouselLayout({ width: 1280, height: 640 }, true).mediaHeight).toBeCloseTo(268.8);
  });
});

describe("What's New slide button", () => {
  it("is the slide's own when it has a label and a link", () => {
    expect(slideCta({ ...STEP, buttonLabel: ' Deposit crypto ', buttonLink: '/deposit' })).toEqual({
      label: 'Deposit crypto',
      link: '/deposit',
    });
  });

  it('is none when either is missing', () => {
    expect(slideCta({ ...STEP, buttonLabel: 'Deposit crypto' })).toBeNull();
    expect(slideCta({ ...STEP, buttonLink: '/deposit', buttonLabel: ' ' })).toBeNull();
  });

  it('reports a carousel with a slide video as video', () => {
    expect(
      whatsNewViewedProps(
        popup({ steps: [STEP, { ...STEP, videoUrl: 'https://cdn.test/slide.mp4' }] }),
        'popup',
      ),
    ).toMatchObject({ format: 'carousel', media_type: 'video' });
  });
});
