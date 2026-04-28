import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureStatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}

export function FeatureStatCard({
  label,
  value,
  icon: Icon,
  className,
}: FeatureStatCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-gradient-to-br from-background/40 to-background/20 border border-border/50 p-4 transition-all duration-200 hover:shadow-md hover:border-border/80 hover:from-background/50 hover:to-background/30',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium mb-1.5">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground">
            {typeof value === 'number' ? `${value.toFixed(2)}%` : value}
          </p>
        </div>
        {Icon && (
          <Icon className="h-5 w-5 text-primary/60 flex-shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}
