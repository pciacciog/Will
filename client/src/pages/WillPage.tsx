import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import SharedWillHub from "./SharedWillHub";
import WillDetails from "./WillDetails";

export default function WillPage() {
  const { id } = useParams();
  const willId = parseInt(id || "0");
  const { user } = useAuth();

  const { data: will, isLoading } = useQuery<{ mode: string; id: number }>({
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

  if (will?.mode === "shared") {
    return <SharedWillHub willId={willId} />;
  }

  return <WillDetails />;
}
