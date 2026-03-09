import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Message {
  id: number;
  circleId: number;
  userId: string;
  text: string;
  createdAt: string;
  user: { firstName: string };
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CircleMessages({
  circleId,
  currentUserId,
}: {
  circleId: number;
  currentUserId: string;
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrolledOnLoad, setHasScrolledOnLoad] = useState(false);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/circles", circleId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/circles/${circleId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const res = await apiRequest("POST", `/api/circles/${circleId}/messages`, {
        text: messageText,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/circles", circleId, "messages"],
      });
      setText("");
    },
  });

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledOnLoad) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      setHasScrolledOnLoad(true);
    }
  }, [messages, hasScrolledOnLoad]);

  useEffect(() => {
    if (messages.length > 0 && hasScrolledOnLoad) {
      const container = scrollContainerRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        if (isNearBottom) {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages.length, hasScrolledOnLoad]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="messages-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="circle-messages">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-3"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-gray-400"
            data-testid="messages-empty"
          >
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${
                    isOwn
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-br-md"
                      : "bg-gray-100 text-gray-900 rounded-bl-md"
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs font-semibold text-emerald-600 mb-0.5">
                      {msg.user.firstName}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  <p
                    className={`text-[10px] mt-1 ${
                      isOwn ? "text-white/60 text-right" : "text-gray-400"
                    }`}
                  >
                    {formatRelativeTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-gray-100">
        {text.length > 400 && (
          <p className="text-[10px] text-gray-400 text-right mb-1">
            {text.length}/500
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= 500) setText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-50 text-gray-900 placeholder:text-gray-400 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-gray-200 min-h-[36px] max-h-[100px]"
            style={{
              height: "auto",
              overflow: "hidden",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 100) + "px";
            }}
            data-testid="input-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-full h-9 w-9 shrink-0 shadow-md"
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
