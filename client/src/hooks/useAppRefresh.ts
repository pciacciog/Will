import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useAppRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAppStateChange = () => {
      // Force refresh all queries when app comes back to foreground
      queryClient.invalidateQueries();
    };

    // Add both mobile and web focus handling
    const handleFocus = () => {
      queryClient.invalidateQueries();
    };

    // Mobile app state change listener - skip for now to avoid build errors
    // Will be re-enabled when Capacitor App is properly configured

    // Web focus/visibility change listeners
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    });

    return () => {
      // Mobile cleanup will be added when Capacitor App is properly configured
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [queryClient]);
}