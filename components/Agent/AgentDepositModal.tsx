import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ChevronDown, Leaf, Wallet as WalletIcon } from 'lucide-react-native';

import AgentDepositBorrowForm from '@/components/Agent/AgentDepositBorrowForm';
import AgentDepositExternalForm from '@/components/Agent/AgentDepositExternalForm';
import ResponsiveModal, { ModalState } from '@/components/ResponsiveModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Text } from '@/components/ui/text';

const MODAL_OPEN: ModalState = { name: 'agent-deposit', number: 1 };
const CLOSE_STATE: ModalState = { name: 'close', number: 0 };

type AgentDepositSource = 'borrow' | 'external';

type Props = {
  open: boolean;
  onClose: () => void;
  agentEoaAddress?: string;
};

const AgentDepositModal = ({ open, onClose, agentEoaAddress }: Props) => {
  const [source, setSource] = useState<AgentDepositSource>('borrow');

  useEffect(() => {
    if (!open) setSource('borrow');
  }, [open]);

  return (
    <ResponsiveModal
      currentModal={open ? MODAL_OPEN : CLOSE_STATE}
      previousModal={open ? CLOSE_STATE : MODAL_OPEN}
      isOpen={open}
      onOpenChange={value => {
        if (!value) onClose();
      }}
      trigger={null}
      title="Deposit to Agent Wallet"
      contentKey="agent-deposit"
      containerClassName="min-h-[42rem] overflow-y-auto flex-1"
    >
      <View className="flex-1 gap-4">
        <View className="gap-2">
          <Text className="font-medium opacity-50">From</Text>
          <SourceSelector value={source} onChange={setSource} />
        </View>

        {source === 'external' && agentEoaAddress ? (
          <AgentDepositExternalForm agentEoaAddress={agentEoaAddress} />
        ) : (
          <AgentDepositBorrowForm agentEoaAddress={agentEoaAddress} onSuccess={onClose} />
        )}
      </View>
    </ResponsiveModal>
  );
};

const SOURCE_LABEL: Record<AgentDepositSource, string> = {
  borrow: 'Borrow against Savings',
  external: 'External Wallet',
};

const SOURCE_TOKEN: Record<AgentDepositSource, string> = {
  borrow: '',
  external: 'USDC',
};

const SourceIcon = ({ value }: { value: AgentDepositSource }) =>
  value === 'borrow' ? (
    <Leaf color="#A1A1A1" size={24} />
  ) : (
    <WalletIcon color="#A1A1A1" size={24} />
  );

const SourceSelector = ({
  value,
  onChange,
}: {
  value: AgentDepositSource;
  onChange: (next: AgentDepositSource) => void;
}) =>
  Platform.OS === 'web' ? (
    <SourceSelectorWeb value={value} onChange={onChange} />
  ) : (
    <SourceSelectorNative value={value} onChange={onChange} />
  );

const SourceSelectorWeb = ({
  value,
  onChange,
}: {
  value: AgentDepositSource;
  onChange: (next: AgentDepositSource) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Pressable className="flex-row items-center justify-between rounded-2xl bg-accent p-4">
        <View className="flex-row items-center gap-2">
          <SourceIcon value={value} />
          <Text className="text-lg font-semibold">{SOURCE_LABEL[value]}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {SOURCE_TOKEN[value] ? (
            <Text className="text-sm text-muted-foreground">{SOURCE_TOKEN[value]}</Text>
          ) : null}
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="-mt-4 w-full min-w-[380px] rounded-b-2xl rounded-t-none border-0">
      <DropdownMenuItem
        onPress={() => onChange('borrow')}
        className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
      >
        <Leaf color="#A1A1A1" size={20} />
        <Text className="text-lg">Borrow against Savings</Text>
      </DropdownMenuItem>
      <DropdownMenuItem
        onPress={() => onChange('external')}
        className="flex-row items-center gap-2 px-4 py-3 web:cursor-pointer"
      >
        <WalletIcon color="#A1A1A1" size={20} />
        <Text className="text-lg">External Wallet</Text>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const SourceSelectorNative = ({
  value,
  onChange,
}: {
  value: AgentDepositSource;
  onChange: (next: AgentDepositSource) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const select = useCallback(
    (next: AgentDepositSource) => {
      onChange(next);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <View>
      <Pressable
        className="flex-row items-center justify-between rounded-2xl bg-accent p-4"
        onPress={() => setIsOpen(open => !open)}
      >
        <View className="flex-row items-center gap-2">
          <SourceIcon value={value} />
          <Text className="text-lg font-semibold">{SOURCE_LABEL[value]}</Text>
        </View>
        <View className="flex-row items-center gap-2">
          {SOURCE_TOKEN[value] ? (
            <Text className="text-sm text-muted-foreground">{SOURCE_TOKEN[value]}</Text>
          ) : null}
          <ChevronDown color="#A1A1A1" size={20} />
        </View>
      </Pressable>
      {isOpen && (
        <View className="mt-1 overflow-hidden rounded-2xl bg-accent">
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => select('borrow')}
          >
            <Leaf color="#A1A1A1" size={20} />
            <Text className="text-lg">Borrow against Savings</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-2 px-4 py-3"
            onPress={() => select('external')}
          >
            <WalletIcon color="#A1A1A1" size={20} />
            <Text className="text-lg">External Wallet</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

export default AgentDepositModal;
