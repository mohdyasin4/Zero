import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Loader, PenTool, Sparkles, MessageSquare } from 'lucide-react';
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
    icon: PenTool,
  },
  {
    value: 'casual' as const,
    label: 'Casual', 
    description: 'Friendly and relaxed tone',
    icon: Sparkles,
  },
  {
    value: 'persuasive' as const,
    label: 'Persuasive',
    description: 'Compelling and convincing tone',
    icon: MessageSquare,
  },
];

export function ToneSelector({ 
  onToneTransform, 
  isLoading = false, 
  disabled = false,
  className 
}: ToneSelectorProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [transforming, setTransforming] = useState<ToneType | null>(null);

  const handleToneSelect = async (tone: ToneType) => {
    setTransforming(tone);
    setMenuOpen(false);
    
    try {
      await onToneTransform(tone);
    } catch (error) {
      console.error('Tone transformation failed:', error);
    } finally {
      setTransforming(null);
    }
  };

  const isProcessing = isLoading || transforming !== null;

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          type="button" 
          size="xs" 
          variant="secondary" 
          className={cn(
            "bg-background border hover:bg-gray-50 dark:hover:bg-[#404040] transition-colors cursor-pointer",
            className
          )}
          disabled={disabled || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader className="h-3.5 w-3.5 animate-spin mr-1" />
              {transforming ? `${transforming}...` : 'Processing...'}
            </>
          ) : (
            <>
              <PenTool className="h-3.5 w-3.5 mr-1" />
              Transform
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="z-99999 w-56" align="start" sideOffset={6}>
        {toneOptions.map((option) => {
          const IconComponent = option.icon;
          const isCurrentlyTransforming = transforming === option.value;
          
          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => handleToneSelect(option.value)}
              disabled={isProcessing}
              className="flex items-start gap-3 p-3 cursor-pointer hover:bg-accent/50"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                {isCurrentlyTransforming ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconComponent className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground leading-tight">
                  {option.description}
                </span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}