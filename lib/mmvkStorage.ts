import { createMMKV } from 'react-native-mmkv';

export default function mmkvStorage(id: string) {
  const storage = createMMKV({
    id,
  });

  return {
    setItem: (key: string, value: string) => storage.set(key, value),
    getItem: (key: string) => storage.getString(key) ?? null,
    removeItem: (key: string) => storage.remove(key),
  };
}
