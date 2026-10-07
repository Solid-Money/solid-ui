import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import CardBottomSheet from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet';
import { sheetBodyInset } from '@/components/Card/NewCardDetails/SpendMode/CardBottomSheet.types';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useProfileAvatarStore } from '@/store/useProfileAvatarStore';

import {
  AVATAR_COLORS,
  AvatarColorId,
  DEFAULT_AVATAR_COLOR_ID,
  getAvatarInitial,
} from './avatarColors';
import ProfileAvatar from './ProfileAvatar';

interface EditAvatarSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | undefined;
  name: string;
}

const SWATCH_SIZE = 36;

/**
 * Edit avatar: pick the colour behind the initial.
 *
 * Colour only for now. Choosing or taking a photo needs somewhere to keep the
 * image, and the backend has no avatar storage yet, so those rows are left out
 * rather than offered and saved to this device alone.
 */
const EditAvatarSheet = ({ isOpen, onOpenChange, userId, name }: EditAvatarSheetProps) => {
  const savedColor = useProfileAvatarStore(state =>
    userId ? state.colorByUserId[userId] : undefined,
  );
  const setColor = useProfileAvatarStore(state => state.setColor);
  const [draft, setDraft] = useState<AvatarColorId>(savedColor ?? DEFAULT_AVATAR_COLOR_ID);

  // Every visit starts from what is saved, so Cancel really does throw the draft away.
  useEffect(() => {
    if (isOpen) setDraft(savedColor ?? DEFAULT_AVATAR_COLOR_ID);
  }, [isOpen, savedColor]);

  const save = () => {
    if (userId) setColor(userId, draft);
    onOpenChange(false);
  };

  const initial = getAvatarInitial(name);

  return (
    <CardBottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      contentKey="edit-avatar"
      designTop={36}
      designBottom={16}
    >
      {({ topPadding, presentation }) => (
        <View
          style={{ paddingTop: topPadding, paddingHorizontal: sheetBodyInset(presentation) }}
          className="items-center"
        >
          <Text className="text-lg font-semibold text-white">Edit avatar</Text>

          <View className="mt-6">
            <ProfileAvatar name={name} colorId={draft} size={96} />
          </View>

          <View className="mt-8 w-full">
            <Text className="mb-3 text-sm text-[#8E8E8E]">Color</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {AVATAR_COLORS.map(color => {
                const isSelected = color.id === draft;
                return (
                  <Pressable
                    key={color.id}
                    onPress={() => setDraft(color.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${color.id} avatar`}
                    hitSlop={4}
                    className={cn(
                      'items-center justify-center rounded-full border-2 web:hover:opacity-80',
                      isSelected ? 'border-white' : 'border-transparent',
                    )}
                    style={{ width: SWATCH_SIZE + 6, height: SWATCH_SIZE + 6 }}
                  >
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: SWATCH_SIZE,
                        height: SWATCH_SIZE,
                        backgroundColor: color.bg,
                      }}
                    >
                      <Text className="text-sm font-semibold" style={{ color: color.text }}>
                        {initial}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button variant="brand" className="mt-8 w-full" onPress={save}>
            <Text>Save</Text>
          </Button>
          <Pressable
            onPress={() => onOpenChange(false)}
            accessibilityRole="button"
            className="mt-2 h-12 w-full items-center justify-center active:opacity-70"
          >
            <Text className="text-base font-semibold text-white">Cancel</Text>
          </Pressable>
        </View>
      )}
    </CardBottomSheet>
  );
};

export default EditAvatarSheet;
