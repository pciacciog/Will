import { useQuery } from "@tanstack/react-query";
import { getQueryFn, queryClient } from "@/lib/queryClient";

export type HomeAlertType = 'will_review' | 'friend_request' | 'invite_accepted' | 'proof_drop' | 'explore_match';
export type AlertTargetSection = 'my_wills' | 'friends' | 'explore';

export type HomeAlert = {
  type: HomeAlertType;
  count: number;
  targetSection: AlertTargetSection;
  willIds?: string[];
  userId?: string;
};

export function useHomeAlerts(enabled = true) {
  const { data = [], isLoading, refetch } = useQuery<HomeAlert[]>({
    queryKey: ['/api/home-alerts'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    enabled,
    staleTime: 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const alerts = (data as HomeAlert[] | null) ?? [];

  const getAlerts = (section: AlertTargetSection) =>
    alerts.filter(a => a.targetSection === section);

  const getAlert = (type: HomeAlertType) =>
    alerts.find(a => a.type === type) ?? null;

  const totalForSection = (section: AlertTargetSection) =>
    getAlerts(section).reduce((sum, a) => sum + a.count, 0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/home-alerts'] });

  return { alerts, isLoading, getAlerts, getAlert, totalForSection, invalidate, refetch };
}
