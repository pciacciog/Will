import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/ui/design-system";
import { ArrowLeft } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import type { MemberCardData } from "@/components/MemberCard";

type MembersData = {
  members: MemberCardData[];
  totalCount: number;
};

export default function SeeAllMembersPage() {
  const { id } = useParams<{ id: string }>();
  const willId = parseInt(id!);
  const [, setLocation] = useLocation();

  const { data: membersData, isLoading } = useQuery<MembersData>({
    queryKey: [`/api/wills/${willId}/members-activity`],
    enabled: !!willId,
  });

  const members = membersData?.members ?? [];

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
        <h1 className="text-base font-semibold text-gray-900">
          All Members{members.length > 0 ? ` (${members.length})` : ''}
        </h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))
        ) : members.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No members yet</p>
        ) : (
          members.map(m => <MemberCard key={m.userId} member={m} />)
        )}
      </div>
    </MobileLayout>
  );
}
