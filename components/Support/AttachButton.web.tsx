import { createElement, useRef } from 'react';
import { Pressable } from 'react-native';
import { Paperclip } from 'lucide-react-native';

import { ACCEPTED_MIME } from '@/lib/support/sync';

import type { AttachButtonProps } from '@/components/Support/AttachButton';

/** Whether this platform shows the button (the composer pads around it). */
export const attachAvailable = true;

/** The web's attach button: a hidden file input behind a paperclip. */
export default function AttachButton({ disabled, onPick }: AttachButtonProps) {
  const input = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => input.current?.click()}
        accessibilityRole="button"
        accessibilityLabel="Attach a photo or PDF"
        className="h-9 w-9 items-center justify-center rounded-full disabled:opacity-40 web:hover:bg-white/10"
      >
        <Paperclip size={18} color="#A1A1A1" />
      </Pressable>
      {createElement('input', {
        ref: input,
        type: 'file',
        accept: ACCEPTED_MIME.join(','),
        multiple: true,
        style: { display: 'none' },
        onChange: (event: { target: HTMLInputElement }) => {
          const picked = Array.from(event.target.files ?? []).map(file => ({
            blob: file,
            name: file.name,
            mime: file.type,
            size: file.size,
          }));
          // Cleared, so picking the same file again still fires.
          event.target.value = '';
          if (picked.length) onPick(picked);
        },
      })}
    </>
  );
}
