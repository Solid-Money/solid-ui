/// <reference types="jest" />
import { isSavingsVaultActivity } from '@/constants/transaction';
import { ActivityEvent, TransactionStatus, TransactionType } from '@/lib/types';

function makeActivity(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    clientTxId: 'tx-1',
    type: TransactionType.DEPOSIT,
    status: TransactionStatus.SUCCESS,
    amount: '5',
    symbol: 'USDC',
    timestamp: '1781426763',
    title: 'Deposit USDC on Ethereum',
    ...overrides,
  } as ActivityEvent;
}

describe('isSavingsVaultActivity — card activity stays off the savings screen', () => {
  // The reported bug: a direct deposit routed to the Rain card is recorded as
  // `DEPOSIT`, which resolves to the "Savings account" category, so it read as
  // savings and showed up under the savings balance.
  it('excludes a direct deposit the webhook routed to the card', () => {
    const cardDeposit = makeActivity({
      clientTxId: 'direct_deposit_8453_USDC_1781426763',
      title: 'Card deposit',
      shortTitle: 'Card deposit',
      symbol: 'USDC',
      metadata: { description: 'Card deposit', destinationType: 'RAIN_CARD' },
    });

    expect(isSavingsVaultActivity(cardDeposit)).toBe(false);
  });

  it('excludes older card deposits that predate metadata.destinationType', () => {
    const legacy = makeActivity({ title: 'Card deposit', metadata: {} });

    expect(isSavingsVaultActivity(legacy)).toBe(false);
  });

  // Bridged card funding: `BRIDGE_DEPOSIT` denominated in the vault share token,
  // so neither the type nor the symbol tells it apart from savings.
  it.each([
    ['Deposit soUSD to Card', 'soUSD'],
    ['Deposit USDC to Card', 'USDC.e'],
  ])('excludes the bridged card deposit "%s"', (title, symbol) => {
    const activity = makeActivity({
      type: TransactionType.BRIDGE_DEPOSIT,
      title,
      symbol,
    });

    expect(isSavingsVaultActivity(activity)).toBe(false);
  });

  it.each([
    ['card deposit from savings', TransactionType.CARD_DEPOSIT, 'soUSD', 'Deposit to Card'],
    [
      'borrow-and-deposit to card',
      TransactionType.BORROW_AND_DEPOSIT_TO_CARD,
      'soUSD',
      'Borrow and deposit to card',
    ],
    ['card spend', TransactionType.CARD_TRANSACTION, 'USDC', 'Coffee'],
    ['card withdrawal', TransactionType.CARD_WITHDRAWAL, 'USDC', 'Card withdraw'],
  ])('excludes a %s', (_label, type, symbol, title) => {
    expect(isSavingsVaultActivity(makeActivity({ type, symbol, title }))).toBe(false);
  });

  // These settle card debt against Rain rather than moving vault balance, even
  // though the static category map labels them "Savings account".
  it.each([
    [TransactionType.WITHDRAW_COLLATERAL, 'Withdraw collateral'],
    [TransactionType.REPAY_AND_WITHDRAW_COLLATERAL, 'Repay from collateral'],
  ])('excludes the Rain collateral flow "%s"', (type, title) => {
    expect(isSavingsVaultActivity(makeActivity({ type, title }))).toBe(false);
  });
});

describe('isSavingsVaultActivity — vault deposits and withdrawals are kept', () => {
  it('keeps a direct deposit routed to savings', () => {
    const savingsDeposit = makeActivity({
      clientTxId: 'direct_deposit_1_USDC_1781426763',
      title: 'Deposit USDC on Ethereum',
      metadata: { description: 'Direct deposit', destinationType: 'PROTOCOL' },
    });

    expect(isSavingsVaultActivity(savingsDeposit)).toBe(true);
  });

  it('keeps a connect-wallet deposit denominated in the share token', () => {
    const deposit = makeActivity({ symbol: 'soUSD', title: 'Deposit 100 soUSD' });

    expect(isSavingsVaultActivity(deposit)).toBe(true);
  });

  it.each([
    [TransactionType.WITHDRAW, 'Withdraw 20000 soUSD', 'soUSD'],
    [TransactionType.UNSTAKE, 'Unstake 100 soUSD', 'soUSD'],
    [TransactionType.CANCEL_WITHDRAW, 'Cancel withdraw', 'soUSD'],
    [TransactionType.FAST_WITHDRAW, 'Fast withdraw 10 soUSD', 'soUSD'],
  ])('keeps the vault withdrawal type %s', (type, title, symbol) => {
    expect(isSavingsVaultActivity(makeActivity({ type, title, symbol }))).toBe(true);
  });

  // The same `BRIDGE_DEPOSIT` type that backs card funding also backs real vault
  // movements; only the card-titled ones are dropped.
  it.each([
    ['Stake 100 soUSD to Fuse', 'soUSD'],
    ['Withdraw 20000 soUSD', 'USDC'],
    ['Withdraw 1 soETH', 'soETH'],
    ['Withdraw soUSD to Arbitrum', 'soUSD'],
  ])('keeps the bridged vault movement "%s"', (title, symbol) => {
    const activity = makeActivity({ type: TransactionType.BRIDGE_DEPOSIT, title, symbol });

    expect(isSavingsVaultActivity(activity)).toBe(true);
  });
});

describe('isSavingsVaultActivity — other surfaces stay out', () => {
  // A vault-token symbol used to be enough to qualify, which pulled plain soUSD
  // sends onto the savings screen.
  it('excludes a wallet send denominated in soUSD', () => {
    const send = makeActivity({
      type: TransactionType.SEND,
      title: 'Send 10 soUSD',
      symbol: 'soUSD',
    });

    expect(isSavingsVaultActivity(send)).toBe(false);
  });

  it.each([
    [TransactionType.RECEIVE, 'Received 10 USDC'],
    [TransactionType.FUND, 'Add funds'],
    [TransactionType.BRIDGE, 'Bridge to Arbitrum'],
    [TransactionType.BANK_TRANSFER, 'Bank deposit'],
    [TransactionType.MERCURYO_TRANSACTION, 'Buy crypto'],
    [TransactionType.SWAP, 'Swap USDC for ETH'],
    [TransactionType.MERKL_CLAIM, 'Merkl rewards'],
    [TransactionType.DEPOSIT_BONUS, 'Deposit bonus'],
    [TransactionType.AGENT_WALLET_DEPOSIT, 'Agent wallet deposit'],
    [TransactionType.GOODDOLLAR_CLAIM, 'GoodDollar claim'],
    [TransactionType.RESCUE_TOKEN, 'Recovered 5 USDC'],
  ])('excludes %s activity', (type, title) => {
    expect(isSavingsVaultActivity(makeActivity({ type, title }))).toBe(false);
  });
});
