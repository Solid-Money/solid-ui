import { create } from 'zustand';

interface AiApiRevealState {
  /** The full key just created. Shown once, then cleared. */
  secret: string | null;
  keyName: string | null;
  reveal: (secret: string, keyName: string) => void;
  clear: () => void;
}

/**
 * Hands a freshly created key from the create sheet to the key-ready screen.
 *
 * In memory only, deliberately: never persisted, never put in a route param
 * (a URL ends up in history and logs), and cleared when that screen closes —
 * the backend keeps only a hash, so this is the one moment the key exists in
 * readable form, and it should not outlive it.
 */
export const useAiApiRevealStore = create<AiApiRevealState>()(set => ({
  secret: null,
  keyName: null,
  reveal: (secret, keyName) => set({ secret, keyName }),
  clear: () => set({ secret: null, keyName: null }),
}));
