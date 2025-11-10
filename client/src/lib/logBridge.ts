// Client-side console bridge to forward critical logs to server
// This ensures mobile device logs appear in Replit deployment console

import { getApiPath } from '@/config/api';

class LogBridge {
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
  };
  private isInitialized = false;
  private queuedLogs: any[] = [];
  private sendQueue: any[] = [];
  private isOnline = navigator.onLine;

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };

    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushLogs();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  initialize() {
    if (this.isInitialized) return;

    // Patch console methods
    console.log = (...args) => {
      this.originalConsole.log(...args);
      this.forwardLog('info', this.formatMessage(args));
    };

    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      this.forwardLog('warn', this.formatMessage(args));
    };

    console.error = (...args) => {
      this.originalConsole.error(...args);
      this.forwardLog('error', this.formatMessage(args));
    };

    this.isInitialized = true;
    
    // Process any queued logs
    this.flushLogs();
    
    console.log('[LogBridge] Console bridge initialized - client logs will appear in server console');
  }

  private formatMessage(args: any[]): string {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
  }

  private shouldForwardLog(message: string): boolean {
    // Only forward critical logs to avoid overwhelming the server
    const criticalPatterns = [
      // Device token registration
      'Device Token Successfully Registered',
      'Push registration success',
      'Device token received',
      
      // Router and authentication
      'Router debug',
      'User authenticated',
      'Authentication failed',
      
      // WebView lifecycle
      'WebView loaded',
      'App initialized',
      
      // Critical errors
      'Error',
      'Failed',
      'CRITICAL',
      
      // Push notification events
      'Push notification',
      'NotificationService',
      
      // End room events
      'End Room',
      'Video call'
    ];

    return criticalPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  private forwardLog(level: string, message: string) {
    // Only forward critical logs
    if (!this.shouldForwardLog(message)) return;

    const logEntry = {
      level,
      message,
      source: 'client',
      timestamp: new Date().toISOString(),
      userAgent: this.detectPlatform(),
    };

    if (this.isOnline && this.isInitialized) {
      this.sendToServer(logEntry);
    } else {
      // Queue for later if offline
      this.queuedLogs.push(logEntry);
    }
  }

  private detectPlatform(): string {
    const userAgent = navigator.userAgent;
    
    // Check for Capacitor iOS
    if (window.Capacitor?.isNativePlatform()) {
      return 'iPhone';
    }
    
    // Check for iOS Safari
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      return 'iOS Safari';
    }
    
    // Check for other mobile platforms
    if (/Android/.test(userAgent)) {
      return 'Android';
    }
    
    // Default to Web
    return 'Web';
  }

  private async sendToServer(logEntry: any) {
    try {
      const response = await fetch(getApiPath('/api/logs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logEntry),
      });

      if (!response.ok) {
        // If sending fails, queue for retry
        this.queuedLogs.push(logEntry);
      }
    } catch (error) {
      // Network error - queue for retry
      this.queuedLogs.push(logEntry);
    }
  }

  private async flushLogs() {
    if (!this.isOnline || this.queuedLogs.length === 0) return;

    const logsToSend = [...this.queuedLogs];
    this.queuedLogs = [];

    for (const logEntry of logsToSend) {
      await this.sendToServer(logEntry);
    }
  }

  // Method to manually send a critical log
  public sendCriticalLog(level: 'info' | 'warn' | 'error', message: string) {
    this.forwardLog(level, message);
  }
}

// Export singleton instance
export const logBridge = new LogBridge();

// Global declaration for Capacitor
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform(): boolean;
    };
  }
}