import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TeamWillHub from "./TeamWillHub";
import WillDetails from "./WillDetails";
import SoloWillViewer from "./SoloWillViewer";

interface WillMeta {
  id: number;
  mode: string;
  kind: string | null;
  createdBy: string;
  status: string;
}

export default function WillPage() {
  const { id } = useParams();
  const willId = parseInt(id || "0");
  const { user } = useAuth();

  // Use /meta — returns only safe routing fields, never private data like "because"
  const { data: meta, isLoading } = useQuery<WillMeta>({
    queryKey: [`/api/wills/${willId}/meta`],
    enabled: !!user && !!willId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (meta?.mode === "team") {
    return <TeamWillHub willId={willId} />;
  }

  // Solo will viewed by a non-owner → read-only viewer screen
  const isSolo = meta?.mode === "personal" || meta?.mode === "solo";
  if (isSolo && user && meta?.createdBy !== user.id) {
    return <SoloWillViewer willId={willId} />;
  }

  return <WillDetails />;
}
