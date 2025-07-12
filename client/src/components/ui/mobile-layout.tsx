import React from 'react';
import { cn } from '@/lib/utils';

interface MobileLayoutProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
}

export function MobileLayout({ 
  children, 
  className, 
  header, 
  footer, 
  scrollable = true 
}: MobileLayoutProps) {
  return (
    <div className={cn(
      "flex flex-col min-h-screen bg-background",
      // Safe area handling for iOS - wrap entire screen with extra clearance
      "pt-[calc(env(safe-area-inset-top)+1.5rem)] px-4 pb-[env(safe-area-inset-bottom)]",
      className
    )}>
      {/* Header */}
      {header && (
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 pt-4 pb-4">
          {header}
        </div>
      )}
      
      {/* Main content area */}
      <div className={cn(
        "flex-1 flex flex-col",
        scrollable && "overflow-y-auto ios-scroll"
      )}>
        {children}
      </div>
      
      {/* Footer */}
      {footer && (
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-t border-border/50">
          {footer}
        </div>
      )}
    </div>
  );
}

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
}

export function MobileHeader({ 
  title, 
  subtitle, 
  actions, 
  back = false, 
  onBack 
}: MobileHeaderProps) {
  return (
    <div className="px-0 py-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {back && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-accent/50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-foreground truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate mt-0.5 italic">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  shadow?: boolean;
}

export function MobileCard({ 
  children, 
  className, 
  padding = 'md',
  rounded = true,
  shadow = true
}: MobileCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border/50",
      rounded && "rounded-lg",
      shadow && "shadow-sm",
      padding === 'sm' && "p-3",
      padding === 'md' && "p-4",
      padding === 'lg' && "p-6",
      className
    )}>
      {children}
    </div>
  );
}

interface MobileButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export function MobileButton({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className
}: MobileButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };

  const sizes = {
    sm: "h-9 px-3 text-sm rounded-md",
    md: "h-11 px-4 text-base rounded-lg",
    lg: "h-12 px-6 text-lg rounded-lg"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        // Enhanced touch targets for mobile
        "min-h-[44px] min-w-[44px]",
        className
      )}
    >
      {children}
    </button>
  );
}