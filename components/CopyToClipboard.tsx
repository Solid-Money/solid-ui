import * as Clipboard from 'expo-clipboard';
import { Check, Copy } from 'lucide-react-native';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CopyToClipboard = ({ text, className }: { text: string; className?: string }) => {
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
      className={cn('transition-all duration-200 hover:bg-primary/10 active:scale-95', className)}
    >
      {copied ? (
        <Check size={14} className="text-green-500" />
      ) : (
        <Copy size={14} className="text-muted-foreground/60 hover:text-primary" />
      )}
    </Button>
  );
};

export default CopyToClipboard;
