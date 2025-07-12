import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// Mobile Layout - Safe area padded outer layout
// ============================================================================
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
      "flex flex-col h-screen bg-background relative",
      className
    )}>
      {/* Fixed safe area top spacer - always visible above content */}
      <div className="flex-shrink-0 bg-background h-[calc(env(safe-area-inset-top)+3rem)] w-full"></div>
      
      {/* Header */}
      {header && (
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-b border-border/50 sticky top-0 z-10 px-4 pt-4 pb-4">
          {header}
        </div>
      )}
      
      {/* Main content area - scroll-safe container */}
      <div className={cn(
        "flex flex-col flex-1 px-4",
        scrollable && "overflow-y-auto scroll-smooth overscroll-contain ios-scroll",
        // iOS-specific smooth scrolling
        "[&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]"
      )}>
        {children}
      </div>
      
      {/* Footer */}
      {footer && (
        <div className="flex-shrink-0 bg-background/95 backdrop-blur-sm border-t border-border/50 px-4">
          {footer}
        </div>
      )}
      
      {/* Fixed bottom safe area spacer */}
      <div className="flex-shrink-0 bg-background h-[env(safe-area-inset-bottom)] w-full"></div>
    </div>
  );
}

// ============================================================================
// Mobile Header - Enhanced with better spacing
// ============================================================================
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
            <h1 className="text-xl font-semibold text-foreground tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground tracking-tight truncate mt-0.5 italic">
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

// ============================================================================
// Section Card - Wrapper for any screen block
// ============================================================================
interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  rounded?: boolean;
  shadow?: boolean;
}

export function SectionCard({ 
  children, 
  className, 
  padding = 'md',
  rounded = true,
  shadow = true
}: SectionCardProps) {
  return (
    <div className={cn(
      "bg-card border border-border/50",
      rounded && "rounded-xl",
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

// ============================================================================
// Primary Button - Standard green CTA button
// ============================================================================
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}

export function PrimaryButton({ 
  children, 
  onClick, 
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  className
}: PrimaryButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 active:bg-secondary/80",
    secondary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90"
  };

  const sizes = {
    sm: "h-9 px-3 text-sm rounded-lg",
    md: "h-11 px-4 text-base rounded-lg",
    lg: "h-12 px-6 text-lg rounded-xl"
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

// ============================================================================
// Avatar Badge - Circle avatar + member status dot
// ============================================================================
interface AvatarBadgeProps {
  name: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'away';
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AvatarBadge({ 
  name, 
  email, 
  size = 'md',
  status = 'online',
  interactive = false,
  onClick,
  className
}: AvatarBadgeProps) {
  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-16 h-16 text-xl"
  };

  const statusColors = {
    online: "bg-green-400",
    offline: "bg-gray-400",
    away: "bg-yellow-400"
  };

  const statusSizes = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4"
  };

  const initial = name?.charAt(0)?.toUpperCase() || email?.charAt(0)?.toUpperCase() || '?';

  const AvatarComponent = interactive ? 'button' : 'div';

  return (
    <div className={cn("relative", className)}>
      <AvatarComponent
        onClick={onClick}
        className={cn(
          "bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0",
          sizes[size],
          interactive && "hover:scale-105 active:scale-95 transition-transform cursor-pointer"
        )}
      >
        <span className="text-white font-semibold tracking-tight">
          {initial}
        </span>
      </AvatarComponent>
      
      {/* Status indicator */}
      <div className={cn(
        "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white",
        statusColors[status],
        statusSizes[size]
      )} />
    </div>
  );
}

// ============================================================================
// Section Title - Bold section header with optional icon
// ============================================================================
interface SectionTitleProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionTitle({ 
  title, 
  subtitle, 
  icon: Icon, 
  actions, 
  className 
}: SectionTitleProps) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {title}
          </h2>
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1 tracking-tight">
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Action Button - Interactive circular button for actions like +
// ============================================================================
interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  ariaLabel?: string;
}

export function ActionButton({ 
  children, 
  onClick, 
  variant = 'secondary',
  size = 'md',
  className,
  ariaLabel
}: ActionButtonProps) {
  const baseClasses = "rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  
  const variants = {
    primary: "bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 shadow-sm hover:shadow-md active:shadow-lg",
    secondary: "bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300 active:scale-95",
    ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  };

  const sizes = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl"
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        baseClasses,
        variants[variant],
        sizes[size],
        className
      )}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}