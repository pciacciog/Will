import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export interface SubscriptionStatus {
  hasAccess: boolean;
  isGrandfathered: boolean;
  isSubscribed: boolean;
  isTrialing: boolean;
  status: string | null;
  trialEndsAt: string | null;
  daysLeft: number | null;
}

export function useSubscription(enabled: boolean) {
  const { data, isLoading, isError, refetch } = useQuery<SubscriptionStatus | null>({
    queryKey: ["/api/subscription/status"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled,
    retry: 2,
    staleTime: 60_000,
  });

  return {
    subscription: data ?? null,
    isLoading: enabled && isLoading,
    isError,
    refetch,
  };
}
