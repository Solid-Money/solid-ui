import {
  CardDetailsResponseDto,
  CardDetailsRevealResponse,
  CardProvider,
  CardStatus,
  CardStatusResponse,
  KycStatus,
  RainApplicationStatus,
} from '@/lib/types';

export const DUMMY_USER_ID = 'dummy';

/** Keep dummy data unavailable in production, even if persisted dev state survives a rebuild. */
export const isDummyUserId = (userId: string | undefined): boolean =>
  __DEV__ && userId === DUMMY_USER_ID;

export const DUMMY_CARD_STATUS: CardStatusResponse = {
  status: CardStatus.ACTIVE,
  provider: CardProvider.RAIN,
  kycStatus: KycStatus.APPROVED,
  rainApplicationStatus: RainApplicationStatus.APPROVED,
  country: 'SG',
};

export const DUMMY_CARD_DETAILS: CardDetailsResponseDto = {
  id: 'dummy-card',
  client_reference_id: 'dummy-card-reference',
  customer_id: 'dummy-customer',
  card_image_url: '',
  status: CardStatus.ACTIVE,
  status_reason: '',
  card_details: {
    last_4: '4242',
    expiry: '12/34',
    bin: '424242',
  },
  cardholder_name: {
    first_name: 'Dummy',
    last_name: 'User',
  },
  balances: {
    available: { amount: '1250.00', currency: 'USD' },
    hold: { amount: '0', currency: 'USD' },
  },
  freezes: [],
  crypto_account: {
    type: 'evm',
    address: '0x0000000000000000000000000000000000000000',
  },
  funding_instructions: {
    currency: 'USDC',
    chain: 'base',
    address: '0x0000000000000000000000000000000000000000',
    memo: '',
  },
  cashback: {
    monthlySoUsdAmount: 0,
    monthlyUsdValue: 0,
    totalSoUsdAmount: 0,
    totalUsdValue: 0,
    percentage: 3,
  },
  provider: CardProvider.RAIN,
  issuing_country: 'SG',
};

export const DUMMY_CARD_REVEAL: CardDetailsRevealResponse = {
  card_number: '4242424242424242',
  card_security_code: '123',
  expiry_date: '12/34',
};
