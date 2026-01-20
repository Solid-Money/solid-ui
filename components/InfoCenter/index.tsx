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
      className="web:hover:bg-secondary-hover h-9 w-9 flex-row items-center justify-center rounded-full bg-[#2C2C2C] transition-all active:scale-95 active:opacity-80"
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
      <Text className="text-base font-semibold">Support</Text>
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
      <Text className="text-base font-semibold">Docs</Text>
    </>
  );
};

const onInfoCenterDocsPress = () => {
  Linking.openURL('https://support.solid.xyz');
};

const InfoCenterLegal = () => {
  return (
    <>
      <DocsIcon width={20} height={20} />
      <Text className="text-base font-semibold">Legal</Text>
    </>
  );
};

const onInfoCenterLegalPress = () => {
  Linking.openURL(
    'https://support.solid.xyz/en/articles/13184959-legal-privacy-policy-terms-conditions#h_5cf45398ce',
  );
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
