import React from 'react';
import { cn } from '@/lib/utils';

interface HelpIconProps {
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HelpIcon({ onClick, className, size = 'md' }: HelpIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg bg-white shadow-md flex items-center justify-center border border-gray-200 hover:shadow-lg hover:bg-gray-50 transition-all duration-200",
        sizeClasses[size],
        className
      )}
    >
      <span className={cn(
        "font-semibold text-gray-600",
        textSizeClasses[size]
      )}>
        ?
      </span>
    </button>
  );
}