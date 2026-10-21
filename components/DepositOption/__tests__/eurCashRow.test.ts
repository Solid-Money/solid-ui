import { resolveEurCashRow } from '@/components/DepositOption/eurCashRow';

describe('resolveEurCashRow', () => {
  it('opens the IBAN for a user Wirex serves', () => {
    expect(
      resolveEurCashRow({ provider: 'wirex', residenceRequired: true, countryPickedByHand: false }),
    ).toBe('bank-account');
  });

  it('asks where they live when the guess is Rain but residence would decide', () => {
    // A tester outside Europe, or someone living in France on a trip abroad.
    expect(
      resolveEurCashRow({ provider: 'rain', residenceRequired: true, countryPickedByHand: false }),
    ).toBe('ask-residence');
  });

  it('does not ask again once they have named a country', () => {
    expect(
      resolveEurCashRow({ provider: 'rain', residenceRequired: true, countryPickedByHand: true }),
    ).toBe('onramp');
  });

  it('keeps the onramp for a user Rain serves for good', () => {
    expect(
      resolveEurCashRow({ provider: 'rain', residenceRequired: false, countryPickedByHand: false }),
    ).toBe('onramp');
  });

  it('keeps the onramp while routing loads', () => {
    expect(
      resolveEurCashRow({
        provider: 'loading',
        residenceRequired: false,
        countryPickedByHand: false,
      }),
    ).toBe('onramp');
  });
});
