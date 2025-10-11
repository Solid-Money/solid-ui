import { path } from '@/constants/path';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

const Coins = () => {
  const router = useRouter();

  useEffect(() => {
    router.replace(path.HOME);
  }, [router]);

  return null;
};

export default Coins;
