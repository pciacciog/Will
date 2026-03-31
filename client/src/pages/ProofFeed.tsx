import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileLayout } from "@/components/ui/mobile-layout";
import { getApiPath } from "@/config/api";
import { sessionPersistence } from "@/services/SessionPersistence";

type ProofDrop = {
  id: number;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: string;
  firstName: string | null;
  email: string;
};

type ProofResponse = {
  items: ProofDrop[];
  hasMore: boolean;
  nextCursor: string | null;
};

interface ProofFeedProps {
  circleId: number;
}

type PhotoModal = {
  imageUrl: string;
  firstName: string | null;
  email: string;
  caption: string | null;
  createdAt: string;
} | null;

export default function ProofFeed({ circleId }: ProofFeedProps) {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const willId = params.get('willId') ? parseInt(params.get('willId')!) : null;

  const [cursor, setCursor] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<ProofDrop[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [photoModal, setPhotoModal] = useState<PhotoModal>(null);

  const { data, isLoading } = useQuery<ProofResponse>({
    queryKey: [`/api/circles/${circleId}/proofs`, willId, 'feed-init'],
    queryFn: async () => {
      const token = await sessionPersistence.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const qs = new URLSearchParams({ limit: '20' });
      if (willId) qs.set('willId', String(willId));
      const resp = await fetch(getApiPath(`/api/circles/${circleId}/proofs?${qs}`), {
        credentials: 'include',
        headers,
      });
      if (!resp.ok) throw new Error('Failed to fetch proofs');
      const result = await resp.json();
      setAllItems(result.items);
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
      return result;
    },
    enabled: !!circleId,
    staleTime: 0,
  });

  const loadMore = async () => {
    if (!cursor || !hasMore) return;
    const token = await sessionPersistence.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const qs = new URLSearchParams({ limit: '20', cursor });
    if (willId) qs.set('willId', String(willId));
    const resp = await fetch(getApiPath(`/api/circles/${circleId}/proofs?${qs}`), {
      credentials: 'include',
      headers,
    });
    if (!resp.ok) return;
    const result: ProofResponse = await resp.json();
    setAllItems(prev => [...prev, ...result.items]);
    setHasMore(result.hasMore);
    setCursor(result.nextCursor);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <MobileLayout className="bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <div className="max-w-sm mx-auto w-full">

        {/* Header */}
        <div className="relative flex items-center justify-between mb-4 min-h-[44px]">
          <button
            onClick={() => setLocation(`/circles/${circleId}`)}
            className="w-11 h-11 -ml-2 flex items-center justify-center"
            data-testid="button-back"
            aria-label="Go back"
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
              <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
            </span>
          </button>
          <h1 className="absolute left-0 right-0 text-center text-xl font-semibold text-gray-900 pointer-events-none">
            Proof
          </h1>
          <div className="w-9" />
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && allItems.length === 0 && (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 bg-emerald-50 rounded-full border-2 border-emerald-100 flex items-center justify-center">
              <Camera className="w-7 h-7 text-emerald-400 opacity-60" />
            </div>
            <h3 className="text-base font-medium text-gray-900 mb-1">No drops yet</h3>
            <p className="text-sm text-gray-500">Be the first to post proof.</p>
          </div>
        )}

        {/* Feed */}
        {allItems.length > 0 && (
          <div className="space-y-4">
            {allItems.map((proof) => {
              const name = proof.firstName || proof.email?.split('@')[0] || '?';
              const initial = name.charAt(0).toUpperCase();
              return (
                <button
                  key={proof.id}
                  onClick={() => setPhotoModal({
                    imageUrl: proof.imageUrl,
                    firstName: proof.firstName,
                    email: proof.email,
                    caption: proof.caption,
                    createdAt: proof.createdAt,
                  })}
                  className="w-full text-left bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  data-testid={`button-proof-item-${proof.id}`}
                >
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={proof.thumbnailUrl || proof.imageUrl}
                      alt="Proof"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      <p className="text-xs text-gray-500">{formatDate(proof.createdAt)}</p>
                    </div>
                  </div>
                  {proof.caption && (
                    <p className="px-3 pb-3 text-sm text-gray-600 italic">"{proof.caption}"</p>
                  )}
                </button>
              );
            })}

            {hasMore && (
              <Button
                onClick={loadMore}
                variant="outline"
                className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                data-testid="button-load-more"
              >
                Load more
              </Button>
            )}
          </div>
        )}

      </div>

      {/* Full-screen photo modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPhotoModal(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">
                {photoModal.firstName || photoModal.email?.split('@')[0]}
              </p>
              <p className="text-xs text-white/60">
                {new Date(photoModal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={() => setPhotoModal(null)}
              className="w-8 h-8 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
              data-testid="button-close-photo-modal"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photoModal.imageUrl}
              alt="Proof"
              className="max-w-full max-h-full rounded-xl object-contain shadow-2xl"
            />
          </div>
          {photoModal.caption && (
            <p className="text-white/80 text-sm px-4 pb-6 text-center">{photoModal.caption}</p>
          )}
        </div>
      )}
    </MobileLayout>
  );
}
