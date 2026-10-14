import type { SupportFile } from '@/lib/types/support';

export interface AttachButtonProps {
  disabled?: boolean;
  onPick: (files: SupportFile[]) => void;
}

/**
 * Attaching on iOS and Android needs the image and document pickers, which
 * ship with the next native build; until then the app's composer has no
 * attach button (the web has one). Agents can still ask for files by email.
 */
/** Whether this platform shows the button (the composer pads around it). */
export const attachAvailable = false;

export default function AttachButton(_props: AttachButtonProps) {
  return null;
}
