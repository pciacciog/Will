import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import TeamWillHub from "./TeamWillHub";
import TeamWillViewer from "./TeamWillViewer";
import WillDetails from "./WillDetails";
import SoloWillViewer from "./SoloWillViewer";

interface WillMeta {
  id: number;
  mode: string;
  kind: string | null;
  createdBy: string;
  status: string;
  isMember?: boolean;
}

export default function WillPage() {
  const { id } = useParams();
  const willId = parseInt(id || "0");
  const { user } = useAuth();

  // /meta returns only safe routing fields — no private data like "because"
  // placeholderData seeds the result instantly from the all-active cache so we
  // never show a loading spinner when navigating from My Wills (data already cached).
  const { data: meta, isLoading } = useQuery<WillMeta>({
    queryKey: [`/api/wills/${willId}/meta`],
    enabled: !!user && !!willId,
    staleTime: 30000,
    placeholderData: () => {
      // Try to seed routing info from the all-active cache
      const allActive = queryClient.getQueryData<any[]>(['/api/wills/all-active']);
      const cached = allActive?.find((w: any) => w.id === willId);
      if (cached) {
        return {
          id: willId,
          mode: cached.mode,
          kind: cached.kind ?? null,
          createdBy: cached.createdBy,
          status: cached.status,
          // Any will in all-active means this user is a participant → isMember true
          isMember: true,
        } as WillMeta;
      }
      return undefined;
    },
  });

  // Only show spinner when there is genuinely no data at all (not even placeholder)
  if (isLoading && !meta) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (meta?.mode === "team") {
    // Members see the full hub; non-members see the read-only viewer
    return meta.isMember
      ? <TeamWillHub willId={willId} />
      : <TeamWillViewer willId={willId} />;
  }

  // Solo will viewed by a non-owner → read-only viewer screen
  const isSolo = meta?.mode === "personal" || meta?.mode === "solo";
  if (isSolo && user && meta?.createdBy !== user.id) {
    return <SoloWillViewer willId={willId} />;
  }

  return <WillDetails />;
}
