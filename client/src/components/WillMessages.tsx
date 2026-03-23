import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface Message {
  id: number;
  willId: number;
  userId: string;
  text: string;
  createdAt: string;
  user: { firstName: string };
}

function formatExactTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export default function WillMessages({
  willId,
  currentUserId,
}: {
  willId: number;
  currentUserId: string;
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hasScrolledOnLoad, setHasScrolledOnLoad] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const prevMessageCountRef = useRef(0);

  const { data: rawMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/wills", willId, "messages"],
    queryFn: async () => {
      const res = await apiRequest(`/api/wills/${willId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 10000,
  });
  const messages = rawMessages ?? [];

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const res = await apiRequest(`/api/wills/${willId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: messageText }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/wills", willId, "messages"],
      });
      setText("");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "36px";
          inputRef.current.focus();
        }
      }, 50);
    },
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 150;
  }, []);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledOnLoad) {
      setTimeout(() => scrollToBottom("auto"), 50);
      setHasScrolledOnLoad(true);
    }
  }, [messages, hasScrolledOnLoad, scrollToBottom]);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && hasScrolledOnLoad) {
      if (isNearBottom()) {
        setTimeout(() => scrollToBottom("smooth"), 50);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, hasScrolledOnLoad, isNearBottom, scrollToBottom]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const onResize = () => {
      const newKeyboardHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardHeight(Math.max(0, newKeyboardHeight));
      if (newKeyboardHeight > 0) {
        setTimeout(() => scrollToBottom("smooth"), 100);
      }
    };

    viewport.addEventListener("resize", onResize);
    viewport.addEventListener("scroll", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
      viewport.removeEventListener("scroll", onResize);
    };
  }, [scrollToBottom]);

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

  const handleTextareaInput = (e: React.FormEvent) => {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 100) + "px";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="will-messages-loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  const inputBarHeight = 60;
  const safeAreaBottom = 34;
  const bottomOffset = keyboardHeight > 0 ? keyboardHeight : 0;

  return (
    <div className="flex flex-col h-full relative" data-testid="will-messages">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          minHeight: 0,
          paddingBottom: inputBarHeight + bottomOffset + (keyboardHeight > 0 ? 8 : safeAreaBottom + 8),
        }}
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-gray-400"
            data-testid="will-messages-empty"
          >
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwn = msg.userId === currentUserId;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDaySeparator = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

            return (
              <div key={msg.id}>
                {showDaySeparator && (
                  <div className="flex items-center justify-center my-3" data-testid={`day-separator-${msg.id}`}>
                    <div className="bg-gray-200 rounded-full px-3 py-0.5">
                      <span className="text-[11px] font-medium text-gray-500">
                        {formatDayLabel(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                )}
                <div
                  className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1.5`}
                  data-testid={`will-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-1.5 ${
                      isOwn
                        ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-[11px] font-semibold text-emerald-600 leading-tight">
                        {msg.user.firstName}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-snug">{msg.text}</p>
                    <p
                      className={`text-[10px] leading-none mt-0.5 ${
                        isOwn ? "text-white/60 text-right" : "text-gray-400 text-right"
                      }`}
                    >
                      {formatExactTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="absolute left-0 right-0 bg-white border-t border-gray-100 px-3 pt-2"
        style={{
          bottom: bottomOffset,
          paddingBottom: keyboardHeight > 0 ? 8 : "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        }}
      >
        {text.length > 400 && (
          <p className="text-[10px] text-gray-400 text-right mb-1">
            {text.length}/500
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              if (e.target.value.length <= 500) setText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onInput={handleTextareaInput}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-50 text-gray-900 placeholder:text-gray-400 rounded-2xl px-3.5 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 border border-gray-200"
            style={{
              height: "36px",
              maxHeight: "100px",
              overflow: "hidden",
            }}
            data-testid="input-will-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className={`rounded-full h-9 w-9 shrink-0 shadow-md transition-all duration-200 ${
              text.trim()
                ? "bg-gradient-to-br from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 opacity-100"
                : "bg-gray-300 opacity-50 cursor-not-allowed"
            }`}
            data-testid="button-send-will-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
