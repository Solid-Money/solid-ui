import WarningNotice from '@/components/WarningNotice';

interface ContractAddressWarningProps {
  chainName: string;
}

const ContractAddressWarning = ({ chainName }: ContractAddressWarningProps) => (
  <WarningNotice
    title="This appears to be a smart contract address"
    body={`Please verify that the recipient address is able to receive assets on ${chainName}`}
    titleClassName="max-w-64"
    bodyClassName="max-w-72"
  />
);

export default ContractAddressWarning;
