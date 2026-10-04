import type { CashbackCategoryKey } from './categoryCashback';
import type { ImageSource } from 'expo-image';

interface BrandLayer {
  source: ImageSource;
  width: number;
  height: number;
  left: number;
  top: number;
  flipY?: boolean;
}

export interface CategoryCashbackBrand {
  name: string;
  background?: { color: string; size?: number; left?: number; top?: number; radius?: number };
  layers: BrandLayer[];
  ring?: 'rides' | 'airlines';
  badgeText?: string;
}

// Positions and intrinsic SVG dimensions are the 30px merchant slots exported
// from Figma 27572:3100, including the ring and transformed logo layers.
export const CATEGORY_CASHBACK_BRANDS: Record<CashbackCategoryKey, CategoryCashbackBrand[]> = {
  ai: [
    {
      name: 'OpenAI',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/openai.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'Claude',
      background: { color: '#D97757', left: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/claude.svg'),
          width: 20.4545,
          height: 20.4545,
          left: 6,
          top: 5,
        },
      ],
    },
    {
      name: 'Gemini',
      background: { color: '#FFFFFF' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/gemini.svg'),
          width: 24.5455,
          height: 24.5455,
          left: 2.73,
          top: 2.73,
        },
      ],
    },
  ],
  streaming: [
    {
      name: 'Netflix',
      background: { color: '#000000' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/netflix.svg'),
          width: 10.9091,
          height: 20.4545,
          left: 9.55,
          top: 4.09,
        },
      ],
    },
    {
      name: 'Disney',
      background: { color: '#FFFFFF', size: 29, left: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/disney.svg'),
          width: 21.0909,
          height: 21.0909,
          left: 4.95,
          top: 3.95,
        },
        {
          source: require('@/assets/images/subscription-cashback/disney-plus.svg'),
          width: 18.7843,
          height: 18.7842,
          left: 6.76,
          top: 5.76,
        },
      ],
    },
    {
      name: 'HBO Max',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/hbo.svg'),
          width: 29,
          height: 29,
          left: 1,
          top: 0,
        },
      ],
    },
    {
      name: 'Amazon Prime',
      background: { color: '#FFFFFF', size: 28, left: 1, top: 1 },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/amazon.svg'),
          width: 17.805,
          height: 17.8111,
          left: 6.11,
          top: 6.09,
        },
      ],
    },
    {
      name: 'Apple TV',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/apple-tv.svg'),
          width: 28,
          height: 28,
          left: 1,
          top: 1,
        },
      ],
    },
  ],
  music: [
    {
      name: 'Spotify',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/spotify.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'Apple Music',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/apple-music.svg'),
          width: 30,
          height: 30,
          left: 0,
          top: 0,
        },
      ],
    },
    {
      name: 'Youtube Music',
      background: { color: '#FFFFFF' },
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/youtube.svg'),
          width: 21.8182,
          height: 15.2727,
          left: 4.09,
          top: 7.36,
        },
      ],
    },
  ],
  rides: [
    {
      name: 'Uber',
      background: { color: '#000000', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/uber.svg'),
          width: 16.1538,
          height: 5.45728,
          left: 6.92,
          top: 12.28,
        },
      ],
    },
    {
      name: 'Grab',
      background: { color: '#00B14F', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/grab.svg'),
          width: 15.055,
          height: 5.79629,
          left: 6.64,
          top: 12.26,
          flipY: true,
        },
      ],
    },
    {
      name: 'Bolt',
      background: { color: '#2B9C64', radius: 13 },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/bolt.svg'),
          width: 15.563,
          height: 9.05635,
          left: 7.21,
          top: 10.47,
        },
      ],
    },
    {
      name: 'Gojek',
      background: { color: '#FFFFFF' },
      ring: 'rides',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/gojek.svg'),
          width: 20.7369,
          height: 20.8027,
          left: 4.62,
          top: 4.62,
        },
      ],
    },
  ],
  airlines: [
    {
      name: 'Emirates',
      background: { color: '#D72027', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/emirates.svg'),
          width: 19.0385,
          height: 15.691,
          left: 5.48,
          top: 7.15,
        },
      ],
    },
    {
      name: 'Turkish Airlines',
      background: { color: '#FFFFFF', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/turkish.svg'),
          width: 25.3848,
          height: 25.3848,
          left: 2.31,
          top: 2.31,
          flipY: true,
        },
      ],
    },
    {
      name: 'Singapore Airlines',
      background: { color: '#FFFFFF', radius: 13 },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/singapore.svg'),
          width: 12.5075,
          height: 17.3458,
          left: 8.76,
          top: 6.35,
        },
      ],
    },
    {
      name: 'Qatar Airways',
      background: { color: '#56002D' },
      ring: 'airlines',
      layers: [
        {
          source: require('@/assets/images/subscription-cashback/qatar.svg'),
          width: 24.2308,
          height: 23.6865,
          left: 5.77,
          top: 1.15,
          flipY: true,
        },
      ],
    },
    {
      name: '8 more airlines',
      background: { color: '#333333' },
      ring: 'airlines',
      layers: [],
      badgeText: '+8',
    },
  ],
};
