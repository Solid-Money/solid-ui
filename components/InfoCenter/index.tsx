import { useCallback } from 'react';
import { Linking, Pressable } from 'react-native';

import DocsIcon from '@/assets/images/docs';
import QuestionIcon from '@/assets/images/question';
import SupportIcon from '@/assets/images/support';
import { Text } from '@/components/ui/text';
import { useIntercom } from '@/lib/intercom';

const InfoCenterTrigger = (props: any) => {
  return (
    <Pressable
      className="w-9 h-9 flex-row items-center justify-center bg-button-secondary rounded-full active:scale-95 transition-all web:hover:bg-secondary-hover active:opacity-80"
      {...props}
    >
      <QuestionIcon width={14} height={14} />
    </Pressable>
  );
};

const InfoCenterSupport = () => {
  return (
    <>
      <SupportIcon width={20} height={20} />
      <Text className="font-semibold text-base">Support</Text>
    </>
  );
};

const useInfoCenterSupportPress = () => {
  const intercom = useIntercom();
  return useCallback(() => {
    intercom?.show();
  }, [intercom]);
};

const InfoCenterDocs = () => {
  return (
    <>
      <DocsIcon width={20} height={20} />
      <Text className="font-semibold text-base">Docs</Text>
    </>
  );
};

const onInfoCenterDocsPress = () => {
  Linking.openURL('https://docs.solid.xyz');
};

const InfoCenterLegal = () => {
  return (
    <>
      <DocsIcon width={20} height={20} />
      <Text className="font-semibold text-base">Legal</Text>
    </>
  );
};

const onInfoCenterLegalPress = () => {
  Linking.openURL('https://docs.solid.xyz/community-and-resources-1/terms-and-conditions');
};

export {
  InfoCenterDocs,
  InfoCenterLegal,
  InfoCenterSupport,
  InfoCenterTrigger,
  onInfoCenterDocsPress,
  onInfoCenterLegalPress,
  useInfoCenterSupportPress,
};
