import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CopyToClipboard = ({
  text,
  className,
  iconClassName,
  size = 14,
}: {
  text: string;
  className?: string;
  iconClassName?: string;
  size?: number;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    setCopied(true);
    await Clipboard.setStringAsync(text);
  };

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
        <Copy
          size={size}
          className={cn('text-muted-foreground/60 hover:text-primary', iconClassName)}
        />
      )}
    </Button>
  );
};

export default CopyToClipboard;
