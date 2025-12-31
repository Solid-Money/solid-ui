import { Text } from '@/components/ui/text';
import { intervalToDuration } from 'date-fns';
import { useEffect } from 'react';

type EstimatedTimeProps = {
  currentTime: number;
  setCurrentTime: (time: number) => void;
};

export default function EstimatedTime({ currentTime, setCurrentTime }: EstimatedTimeProps) {
  useEffect(() => {
    if (currentTime <= 0) return;

    const interval = setInterval(() => {
      setCurrentTime(Math.max(0, currentTime - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTime, setCurrentTime]);

  if (currentTime <= 0) {
    return <Text className="font-bold md:text-lg">Taking longer than usual</Text>;
  }

  const duration = intervalToDuration({ start: 0, end: currentTime * 1000 });
  const minutes = String(duration.minutes || 0).padStart(2, '0');
  const seconds = String(duration.seconds || 0).padStart(2, '0');

  return <Text className="text-lg font-bold">{`${minutes}:${seconds} min`}</Text>;
}
