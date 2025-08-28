import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader, Type } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ToneType = 'formal' | 'casual' | 'persuasive';

interface ToneSelectorProps {
  onToneTransform: (tone: ToneType) => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
}

const toneOptions = [
  {
    value: 'formal' as const,
    label: 'Formal',
    description: 'Professional and polite tone',
  },
  {
    value: 'casual' as const,
    label: 'Casual',
    description: 'Friendly and relaxed tone',
  },
  {
    value: 'persuasive' as const,
    label: 'Persuasive',
    description: 'Compelling and convincing tone',
  },
];

export function ToneSelector({ 
  onToneTransform, 
  isLoading = false, 
  disabled = false,
  className 
}: ToneSelectorProps) {
  const [selectedTone, setSelectedTone] = useState<ToneType | ''>('');

  const handleToneTransform = async () => {
    if (selectedTone && selectedTone !== '') {
      await onToneTransform(selectedTone);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select
        value={selectedTone}
        onValueChange={(value: ToneType) => setSelectedTone(value)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <div className="flex items-center gap-1.5">
            <Type className="h-3 w-3" />
            <SelectValue placeholder="Tone" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {toneOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Button
        size="xs"
        variant="ghost"
        onClick={handleToneTransform}
        disabled={!selectedTone || isLoading || disabled}
        className="h-7 border border-[#8B5CF6] cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          {isLoading ? (
            <Loader className="h-3 w-3 animate-spin" />
          ) : (
            <Type className="h-3 w-3" />
          )}
          <span className="text-xs">Transform</span>
        </div>
      </Button>
    </div>
  );
}
