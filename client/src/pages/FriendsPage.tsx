import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Search, UserPlus, Check, X, UserMinus, Users, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Friend = {
  friendshipId: number;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
};

type FriendsData = {
  friends: Friend[];
  pendingIncoming: Friend[];
};

type SearchResult = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  friendshipId: number | null;
  friendshipStatus: string | null;
  friendshipDirection: 'sent' | 'received' | null;
};

function getInitial(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return '?';
}

function displayName(firstName: string | null, lastName: string | null, username: string | null) {
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ');
  }
  return username || 'Unknown';
}

export default function FriendsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [optimisticPending, setOptimisticPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(searchQuery.trim()), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const { data: friendsData, isLoading: friendsLoading } = useQuery<FriendsData>({
    queryKey: ['/api/friends'],
    refetchOnMount: true,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<SearchResult[]>({
    queryKey: ['/api/users/search', debouncedQ],
    queryFn: async () => {
      if (!debouncedQ || debouncedQ.length < 2) return [];
      const res = await apiRequest(`/api/users/search?q=${encodeURIComponent(debouncedQ)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: debouncedQ.length >= 2,
    staleTime: 30000,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      return res.json();
    },
    onMutate: (userId: string) => {
      setOptimisticPending(prev => new Set([...prev, userId]));
    },
    onError: (error: any, userId: string) => {
      setOptimisticPending(prev => { const next = new Set(prev); next.delete(userId); return next; });
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/search'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await apiRequest(`/api/friends/${friendshipId}/accept`, { method: 'PATCH' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({ title: "Friend added!", description: "You are now friends." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to accept request", variant: "destructive" });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await apiRequest(`/api/friends/${friendshipId}/decline`, { method: 'PATCH' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to decline request", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await apiRequest(`/api/friends/${friendshipId}`, { method: 'DELETE' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({ title: "Friend removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove friend", variant: "destructive" });
    },
  });

  const isSearching = debouncedQ.length >= 2;
  const friends = friendsData?.friends ?? [];
  const pendingIncoming = friendsData?.pendingIncoming ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/20">
      <div className="pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <div className="max-w-sm mx-auto px-5">

          {/* Minimal back nav — arrow only, no phantom square */}
          <button
            onClick={() => setLocation('/')}
            className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors mb-5"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>

          {/* Page title — large, breathing room */}
          <div className="mb-6">
            <h1 className="text-[28px] font-bold text-gray-900 leading-tight">Friends</h1>
            <p className="text-[14px] text-gray-500 mt-0.5">Find people to grow with</p>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by username or email"
              className="pl-9 h-11 rounded-xl border-gray-200 bg-white focus:border-purple-400 focus:ring-purple-400/20"
              data-testid="input-search-friends"
            />
          </div>

          {/* Invite CTA — only visible when not actively searching */}
          {!isSearching && (
            <button
              onClick={() => setLocation('/create-team-will')}
              className="w-full mb-6 group"
              data-testid="button-invite-someone"
            >
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm group-hover:shadow-md transition-all duration-200 group-active:scale-[0.98]">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-white font-bold text-[15px] leading-tight">Invite someone</p>
                  <p className="text-white/75 text-[12px] leading-tight mt-0.5">Accountability is better together</p>
                </div>
              </div>
            </button>
          )}

          {/* Search Results */}
          {isSearching && (
            <div className="mb-5">
              {searchLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                </div>
              ) : !searchResults || searchResults.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">No users found</p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map(result => {
                    const isOptimisticPending = optimisticPending.has(result.id);
                    const effectiveStatus = isOptimisticPending ? 'pending' : result.friendshipStatus;
                    const effectiveDirection = isOptimisticPending ? 'sent' : result.friendshipDirection;

                    return (
                      <div
                        key={result.id}
                        className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
                        data-testid={`card-search-result-${result.id}`}
                      >
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-purple-600">
                            {getInitial(result.firstName, result.lastName, result.username)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {displayName(result.firstName, result.lastName, result.username)}
                          </p>
                          {result.username && (
                            <p className="text-[11px] text-gray-400 truncate">@{result.username}</p>
                          )}
                        </div>
                        {effectiveStatus === 'accepted' ? (
                          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            Friends
                          </span>
                        ) : effectiveStatus === 'pending' && effectiveDirection === 'sent' ? (
                          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full" data-testid={`chip-pending-${result.id}`}>
                            Pending
                          </span>
                        ) : effectiveStatus === 'pending' && effectiveDirection === 'received' ? (
                          <span className="text-[11px] font-medium text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
                            Requested you
                          </span>
                        ) : (
                          <button
                            onClick={() => sendRequestMutation.mutate(result.id)}
                            disabled={sendRequestMutation.isPending}
                            className="flex items-center gap-1 text-[11px] font-semibold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1 rounded-full transition-colors active:scale-95"
                            data-testid={`button-add-friend-${result.id}`}
                          >
                            <UserPlus className="w-3 h-3" />
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pending Incoming Requests */}
          {!isSearching && pendingIncoming.length > 0 && (
            <div className="mb-5">
              <h2 className="text-[13px] font-medium text-gray-500 mb-2">
                Friend requests ({pendingIncoming.length})
              </h2>
              <div className="space-y-2">
                {pendingIncoming.map(person => (
                  <div
                    key={person.friendshipId}
                    className="bg-white border border-purple-100 rounded-xl px-4 py-3 flex items-center gap-3"
                    data-testid={`card-pending-request-${person.userId}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-purple-600">
                        {getInitial(person.firstName, person.lastName, person.username)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {displayName(person.firstName, person.lastName, person.username)}
                      </p>
                      {person.username && (
                        <p className="text-[11px] text-gray-400 truncate">@{person.username}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => declineMutation.mutate(person.friendshipId)}
                        disabled={declineMutation.isPending}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors active:scale-95"
                        data-testid={`button-decline-${person.friendshipId}`}
                        title="Decline"
                      >
                        <X className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <button
                        onClick={() => acceptMutation.mutate(person.friendshipId)}
                        disabled={acceptMutation.isPending}
                        className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors active:scale-95"
                        data-testid={`button-accept-${person.friendshipId}`}
                        title="Accept"
                      >
                        <Check className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends List */}
          {!isSearching && (
            <div>
              <h2 className="text-[13px] font-medium text-gray-500 mb-2">
                Your friends{friends.length > 0 ? ` (${friends.length})` : ''}
              </h2>

              {friendsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                </div>
              ) : friends.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
                  <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Users className="w-7 h-7 text-purple-300" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No friends yet</p>
                  <p className="text-[12px] text-gray-400 mt-1 leading-relaxed">
                    Search above or invite someone<br />who's ready to commit
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map(friend => (
                    <div
                      key={friend.friendshipId}
                      className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3"
                      data-testid={`card-friend-${friend.userId}`}
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-semibold text-purple-600">
                          {getInitial(friend.firstName, friend.lastName, friend.username)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {displayName(friend.firstName, friend.lastName, friend.username)}
                        </p>
                        {friend.username && (
                          <p className="text-[11px] text-gray-400 truncate">@{friend.username}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeMutation.mutate(friend.friendshipId)}
                        disabled={removeMutation.isPending}
                        className="w-8 h-8 rounded-full bg-gray-50 hover:bg-red-50 flex items-center justify-center transition-colors active:scale-95 group"
                        data-testid={`button-remove-friend-${friend.userId}`}
                        title="Remove friend"
                      >
                        <UserMinus className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
