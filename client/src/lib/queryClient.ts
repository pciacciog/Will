import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { sessionPersistence } from "@/services/SessionPersistence";
import { getApiPath } from "@/config/api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await sessionPersistence.getToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
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
  const allHeaders = {
    "X-Requested-With": "XMLHttpRequest",
    "Origin": "https://will-staging-porfirioaciacci.replit.app",
    "Referer": "https://will-staging-porfirioaciacci.replit.app",
    ...(body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
    ...headers
  };
  
  const res = await fetch(fullUrl, {
    method,
    headers: allHeaders,
    body,
    credentials: "include", // Keep for backward compatibility with web sessions
  });

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
    
    // Convert relative URLs to absolute URLs for native apps
    const fullUrl = getApiPath(queryKey[0] as string);
    
    // DEBUG: Log fetch attempts for review endpoints
    if (queryKey[0]?.toString().includes('review')) {
      console.log('[QueryClient] 🔍 FETCH ATTEMPT:', {
        queryKey,
        fullUrl,
        hasAuthHeaders: !!authHeaders.Authorization,
        timestamp: new Date().toISOString()
      });
    }
    
    const res = await fetch(fullUrl, {
      headers: { 
        "X-Requested-With": "XMLHttpRequest",
        "Origin": "https://will-staging-porfirioaciacci.replit.app",
        "Referer": "https://will-staging-porfirioaciacci.replit.app",
        ...authHeaders 
      },
      credentials: "include", // Keep for backward compatibility with web sessions
    });

    // DEBUG: Log responses for review endpoints
    if (queryKey[0]?.toString().includes('review')) {
      console.log('[QueryClient] 📥 FETCH RESPONSE:', {
        queryKey,
        status: res.status,
        statusText: res.statusText,
        timestamp: new Date().toISOString()
      });
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
