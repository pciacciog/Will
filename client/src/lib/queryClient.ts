import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { sessionPersistence } from "@/services/SessionPersistence";
import { getApiPath } from "@/config/api";
import { Capacitor } from "@capacitor/core";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await sessionPersistence.getToken();
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (expiresAt - Date.now() < sevenDaysMs) {
        console.log('[Auth] Token expiring within 7 days — refreshing silently');
        sessionPersistence.attemptTokenRefresh().catch(() => {});
      }
    } catch {}
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// Get platform-appropriate headers
function getPlatformHeaders(): Record<string, string> {
  // On native platforms (iOS/Android), Capacitor HTTP handles CORS automatically
  // Only add explicit CORS headers on web platform
  if (Capacitor.isNativePlatform()) {
    return {
      "X-Requested-With": "XMLHttpRequest",
    };
  }
  
  // Web platform - use current origin dynamically
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return {
    "X-Requested-With": "XMLHttpRequest",
    "Origin": currentOrigin,
    "Referer": currentOrigin,
  };
}

export async function apiRequest(url: string, options?: {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}): Promise<Response> {
  const method = options?.method || 'GET';
  const body = options?.body;
  const headers = options?.headers || {};
  
  // Convert relative URLs to absolute URLs for native apps
  const fullUrl = getApiPath(url);
  
  // Add auth token if available
  const authHeaders = await getAuthHeaders();
  const platformHeaders = getPlatformHeaders();
  const allHeaders = {
    ...platformHeaders,
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
    ...headers
  };
  
  // On native platforms, credentials are handled by the native HTTP plugin via JWT token
  // Only use credentials: "include" on web for cookie-based session compatibility
  const fetchOptions: RequestInit = {
    method,
    headers: allHeaders,
    body,
  };
  
  if (!Capacitor.isNativePlatform()) {
    fetchOptions.credentials = "include";
  }
  
  let res = await fetch(fullUrl, fetchOptions);

  if (res.status === 401) {
    const refreshed = await sessionPersistence.attemptTokenRefresh();
    if (refreshed) {
      const newAuthHeaders = await getAuthHeaders();
      const retryHeaders = { ...allHeaders, ...newAuthHeaders };
      const retryOptions: RequestInit = { method, headers: retryHeaders, body };
      if (!Capacitor.isNativePlatform()) {
        retryOptions.credentials = "include";
      }
      res = await fetch(fullUrl, retryOptions);
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add auth token if available
    const authHeaders = await getAuthHeaders();
    const platformHeaders = getPlatformHeaders();
    
    // Convert relative URLs to absolute URLs for native apps
    const fullUrl = getApiPath(queryKey[0] as string);
    
    // DEBUG: Log fetch attempts for critical endpoints
    const urlStr = queryKey[0]?.toString() || '';
    if (urlStr.includes('review') || urlStr.includes('all-active')) {
      console.log('[QueryClient] FETCH ATTEMPT:', {
        queryKey,
        fullUrl,
        isNative: Capacitor.isNativePlatform(),
        platform: Capacitor.getPlatform(),
        hasAuthHeaders: !!authHeaders.Authorization,
        timestamp: new Date().toISOString()
      });
    }
    
    // Build fetch options with platform-specific configuration
    const fetchOptions: RequestInit = {
      headers: { 
        ...platformHeaders,
        ...authHeaders 
      },
    };
    
    // Only include credentials on web platform
    if (!Capacitor.isNativePlatform()) {
      fetchOptions.credentials = "include";
    }
    
    let res = await fetch(fullUrl, fetchOptions);

    if (urlStr.includes('review') || urlStr.includes('all-active')) {
      console.log('[QueryClient] FETCH RESPONSE:', {
        queryKey,
        status: res.status,
        statusText: res.statusText,
        timestamp: new Date().toISOString()
      });
    }

    if (res.status === 401) {
      const refreshed = await sessionPersistence.attemptTokenRefresh();
      if (refreshed) {
        const newAuthHeaders = await getAuthHeaders();
        const retryOptions: RequestInit = {
          headers: { ...platformHeaders, ...newAuthHeaders },
        };
        if (!Capacitor.isNativePlatform()) {
          retryOptions.credentials = "include";
        }
        res = await fetch(fullUrl, retryOptions);
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false, // Individual queries will set their own intervals
      refetchOnWindowFocus: true, // Enable refresh on app focus
      refetchOnReconnect: true, // Enable refresh when network reconnects
      staleTime: 0, // Consider data immediately stale for real-time updates
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
