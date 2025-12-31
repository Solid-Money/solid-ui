import { createMMKV, MMKV } from 'react-native-mmkv';

// Singleton MMKV instance to reduce native memory allocations
// Instead of creating 22+ separate MMKV instances, we use one with prefixed keys
let mmkvInstance: MMKV | null = null;

const getMMKVInstance = (): MMKV => {
  if (!mmkvInstance) {
    mmkvInstance = createMMKV({ id: 'solid-app-storage' });
  }
  return mmkvInstance;
};

export default function mmkvStorage(id: string) {
  const storage = getMMKVInstance();
  const prefix = `${id}:`;

  return {
    setItem: (key: string, value: string) => storage.set(`${prefix}${key}`, value),
    getItem: (key: string) => storage.getString(`${prefix}${key}`) ?? null,
    removeItem: (key: string) => storage.remove(`${prefix}${key}`),
  };
}
