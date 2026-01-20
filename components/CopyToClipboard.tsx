import { useCallback, useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Check } from 'lucide-react-native';

import Copy from '@/assets/images/copy';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CopyToClipboard = ({
  text,
  className,
  iconClassName,
  size = 14,
  onCopy,
}: {
  text: string;
  className?: string;
  iconClassName?: string;
  size?: number;
  onCopy?: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    setCopied(true);
    await Clipboard.setStringAsync(text);
    onCopy?.();
  }, [text, onCopy]);

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false);
      }, 1000);
    }
  }, [copied]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onPress={handleCopy}
      className={cn(
        'transition-all duration-200 active:scale-95 web:hover:bg-primary/10',
        className,
      )}
    >
      {copied ? (
        <Check size={size} className="text-green-500" />
      ) : (
        <Copy className={iconClassName} />
      )}
    </Button>
  );
};

export default CopyToClipboard;
