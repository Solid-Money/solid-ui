import { resolveEurCashRow } from '@/components/DepositOption/eurCashRow';

describe('resolveEurCashRow', () => {
  it('opens the IBAN for a user Wirex serves', () => {
    expect(
      resolveEurCashRow({
        provider: 'wirex',
        residenceRequired: false,
        countryPickedByHand: false,
      }),
    ).toBe('bank-account');
  });

  it('asks first when the Wirex answer is only a guess from where the phone is', () => {
    // Opened straight away, a non-IBAN answer on the IBAN screen would go to
    // the Rain USD account rather than to euros.
    expect(
      resolveEurCashRow({ provider: 'wirex', residenceRequired: true, countryPickedByHand: false }),
    ).toBe('ask-residence');
  });

  it('opens the IBAN once they have named an IBAN country', () => {
    expect(
      resolveEurCashRow({ provider: 'wirex', residenceRequired: true, countryPickedByHand: true }),
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
