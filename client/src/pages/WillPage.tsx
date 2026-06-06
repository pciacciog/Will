import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import TeamWillHub from "./TeamWillHub";
import WillDetails from "./WillDetails";
import SoloWillViewer from "./SoloWillViewer";

export default function WillPage() {
  const { id } = useParams();
  const willId = parseInt(id || "0");
  const { user } = useAuth();

  const { data: will, isLoading } = useQuery<{ mode: string; id: number; createdBy: string; kind: string }>({
    queryKey: [`/api/wills/${willId}/details`],
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

  if (will?.mode === "team") {
    return <TeamWillHub willId={willId} />;
  }

  // Solo will viewed by a non-owner → read-only viewer screen
  const isSolo = will?.mode === "personal" || will?.mode === "solo";
  if (isSolo && user && will?.createdBy !== user.id) {
    return <SoloWillViewer willId={willId} />;
  }

  return <WillDetails />;
}
