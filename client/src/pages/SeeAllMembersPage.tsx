import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { MobileLayout } from "@/components/ui/design-system";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MemberCard from "@/components/MemberCard";
import type { MemberCardData } from "@/components/MemberCard";

type MembersData = {
  members: MemberCardData[];
  totalCount: number;
};

type PushStatus = {
  hasUserPushedToday: boolean;
  pushes: { id: number; willId: number; userId: string; pushedAt: string; user: { firstName: string } }[];
};

export default function SeeAllMembersPage() {
  const { id } = useParams<{ id: string }>();
  const willId = parseInt(id!);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: membersData, isLoading } = useQuery<MembersData>({
    queryKey: [`/api/wills/${willId}/members-activity`],
    enabled: !!willId,
  });

  const { data: pushStatus } = useQuery<PushStatus>({
    queryKey: [`/api/wills/${willId}/push/status`],
    enabled: !!willId,
    refetchInterval: 60000,
  });

  const pushMutation = useMutation({
    mutationFn: (targetUserId: string) =>
      apiRequest(`/api/wills/${willId}/push-member/${targetUserId}`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
      toast({ title: "Push sent! 🙌", description: "Keep each other going." });
    },
    onError: (err: any) => {
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('already')) {
        toast({ title: "Already pushed today", description: "Come back tomorrow!" });
        qc.invalidateQueries({ queryKey: [`/api/wills/${willId}/push/status`] });
      } else {
        toast({ title: "Couldn't push", description: msg || "Please try again.", variant: "destructive" });
      }
    },
  });

  const members = membersData?.members ?? [];
  const totalCount = membersData?.totalCount ?? members.length;
  const alreadyPushed = pushStatus?.hasUserPushedToday ?? false;
  const currentUserId = user?.id;

  return (
    <MobileLayout>
      <div
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3 flex items-center gap-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <button
          onClick={() => setLocation(`/public-will/${willId}`)}
          className="text-gray-600 p-1 -ml-1 flex-shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-900" data-testid="text-members-header">
          Members{totalCount > 0 ? ` · ${totalCount} total` : ''}
        </h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : members.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No members yet</p>
        ) : (
          members.map(m => (
            <MemberCard
              key={m.userId}
              member={{ ...m, isYou: m.userId === currentUserId }}
              onPush={(uid) => pushMutation.mutate(uid)}
              alreadyPushed={alreadyPushed}
              pushPending={pushMutation.isPending}
              onTapProfile={(uid) => setLocation(`/profile/${uid}`)}
            />
          ))
        )}
      </div>
    </MobileLayout>
  );
}
