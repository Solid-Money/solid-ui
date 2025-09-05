export interface BridgeTransferSource {
  payment_rail: string;
  currency: string;
  external_account_id?: string | null;
}

export interface BridgeTransferDestination {
  payment_rail: string;
  currency: string;
  to_address?: string;
}

export interface BridgeTransferReceipt {
  initial_amount: string;
  developer_fee: string;
  exchange_fee: string;
  subtotal_amount: string;
  gas_fee: string;
  final_amount: string;
}

export interface BridgeTransferSourceDepositInstructions {
  payment_rail: string;
  currency: string;
  amount: string;
  deposit_message: string;
  bank_account_number: string;
  bank_routing_number: string;
  bank_beneficiary_name: string;
  bank_beneficiary_address: string;
  bank_name: string;
  bank_address: string;
}

export interface BridgeApiTransfer {
  id: string;
  client_reference_id?: string | null;
  state: string;
  on_behalf_of: string;
  currency: string;
  amount: string;
  developer_fee: string;
  source: BridgeTransferSource;
  destination: BridgeTransferDestination;
  receipt: BridgeTransferReceipt;
  source_deposit_instructions?: BridgeTransferSourceDepositInstructions;
  created_at: string;
  updated_at: string;
}
