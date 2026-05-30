import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Send, Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: number;
  willId: number;
  userId: string;
  text: string;
  createdAt: string;
  user: { firstName: string };
}

const MAX_INPUT_HEIGHT = 120; // ~5 lines of text

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
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
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
  });
}

function isSameDay(a: string, b: string): boolean {
  const da = new Date(a), db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function inSameCluster(a: Message, b: Message): boolean {
  if (a.userId !== b.userId) return false;
  if (!isSameDay(a.createdAt, b.createdAt)) return false;
  const diff = Math.abs(
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return diff < 5 * 60 * 1000;
}

export default function WillMessages({
  willId,
  currentUserId,
}: {
  willId: number;
  currentUserId: string;
}) {
  const [text, setText] = useState("");
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [hasScrolledOnLoad, setHasScrolledOnLoad] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevMessageCountRef = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

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
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wills", willId, "messages"] });
      setText("");
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.style.height = "36px";
          inputRef.current.style.overflowY = "hidden";
          inputRef.current.focus();
        }
      }, 50);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't send", description: err.message, variant: "destructive" });
    },
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isNearBottom = useCallback(() => {
    const c = scrollContainerRef.current;
    if (!c) return true;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 150;
  }, []);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledOnLoad) {
      setTimeout(() => scrollToBottom("auto"), 50);
      setHasScrolledOnLoad(true);
    }
  }, [messages, hasScrolledOnLoad, scrollToBottom]);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && hasScrolledOnLoad) {
      if (isNearBottom()) setTimeout(() => scrollToBottom("smooth"), 50);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length, hasScrolledOnLoad, isNearBottom, scrollToBottom]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      const kh = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardHeight(kh);
      if (kh > 0) setTimeout(() => scrollToBottom("smooth"), 80);
    };
    viewport.addEventListener("resize", onResize);
    viewport.addEventListener("scroll", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
      viewport.removeEventListener("scroll", onResize);
    };
  }, [scrollToBottom]);

  const resizeTextarea = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const capped = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT);
    el.style.height = capped + "px";
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  };

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

  const startLongPress = (msg: Message, clientX: number, clientY: number) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setContextMsg(msg);
      setContextPos({ x: clientX, y: clientY });
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const copyMessage = (msg: Message) => {
    navigator.clipboard
      ?.writeText(msg.text)
      .then(() => toast({ title: "Copied to clipboard" }))
      .catch(() => toast({ title: "Couldn't copy", variant: "destructive" }));
    setContextMsg(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="will-messages-loading">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: "#1D9E75" }}
        />
      </div>
    );
  }

  const INPUT_BAR_H = 60;
  const listPadBottom =
    INPUT_BAR_H + (keyboardHeight > 0 ? keyboardHeight + 8 : 34 + 8);

  return (
    <div
      className="flex flex-col h-full relative"
      onClick={() => setContextMsg(null)}
    >
      {/* Long-press context menu */}
      {contextMsg && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
          style={{
            top: Math.min(contextPos.y - 10, window.innerHeight - 80),
            left: Math.max(8, Math.min(contextPos.x - 60, window.innerWidth - 140)),
            minWidth: 130,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-gray-700 active:bg-gray-50"
            onClick={() => copyMessage(contextMsg)}
            data-testid="button-copy-message"
          >
            <Copy className="w-4 h-4 text-gray-500" />
            Copy
          </button>
        </div>
      )}

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ minHeight: 0, paddingBottom: listPadBottom }}
        data-testid="will-messages-list"
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full py-20 gap-2"
            data-testid="will-messages-empty"
          >
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-1">
              <Send className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">Start the conversation</p>
            <p className="text-xs text-gray-400">Be the first to say something!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.userId === currentUserId;
            const prev = i > 0 ? messages[i - 1] : null;
            const next = i < messages.length - 1 ? messages[i + 1] : null;
            const showDay = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const isFirst = !prev || !inSameCluster(prev, msg);
            const isLast = !next || !inSameCluster(msg, next);

            const bubbleShape = isOwn
              ? isLast ? "rounded-2xl rounded-br-[4px]" : "rounded-2xl"
              : isLast ? "rounded-2xl rounded-bl-[4px]" : "rounded-2xl";
            const marginBottom = isLast ? "mb-3" : "mb-[3px]";

            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="flex items-center justify-center my-4" data-testid={`day-sep-${msg.id}`}>
                    <span className="bg-gray-100 rounded-full px-3 py-0.5 text-[11px] font-medium text-gray-500">
                      {formatDayLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                {!isOwn && isFirst && (
                  <p
                    className="text-[11px] font-semibold ml-3 mb-[3px]"
                    style={{ color: "#1D9E75" }}
                  >
                    @{(msg.user?.firstName || "?").toLowerCase()}
                  </p>
                )}

                <div
                  className={`flex ${isOwn ? "justify-end" : "justify-start"} ${marginBottom}`}
                  data-testid={`will-message-${msg.id}`}
                >
                  <div
                    className={`max-w-[78%] ${bubbleShape} px-3 py-[7px] select-none`}
                    style={isOwn ? { backgroundColor: "#1D9E75", color: "#fff" } : { backgroundColor: "#F3F4F6", color: "#111827" }}
                    onTouchStart={(e) => startLongPress(msg, e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                    onMouseDown={(e) => startLongPress(msg, e.clientX, e.clientY)}
                    onMouseUp={cancelLongPress}
                    onMouseLeave={cancelLongPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMsg(msg);
                      setContextPos({ x: e.clientX, y: e.clientY });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                      {msg.text}
                    </p>

                    {isLast && (
                      <div className={`flex items-center gap-1 mt-[3px] justify-end`}>
                        <span
                          className="text-[10px] leading-none"
                          style={{ color: isOwn ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}
                        >
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOwn && (
                          <Check
                            className="w-3 h-3"
                            style={{ color: "rgba(255,255,255,0.6)" }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div
        className="absolute left-0 right-0 bg-white border-t border-gray-100 px-3 pt-2"
        style={{
          bottom: keyboardHeight,
          paddingBottom:
            keyboardHeight > 0
              ? 8
              : ("calc(env(safe-area-inset-bottom, 0px) + 8px)" as any),
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
              if (e.target.value.length <= 500) {
                setText(e.target.value);
                requestAnimationFrame(resizeTextarea);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-gray-50 text-gray-900 placeholder:text-gray-400 rounded-2xl px-3.5 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40 border border-gray-200"
            style={{
              height: "36px",
              maxHeight: MAX_INPUT_HEIGHT + "px",
              overflowY: "hidden",
            }}
            data-testid="input-will-message"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="rounded-full h-11 w-11 shrink-0 flex items-center justify-center transition-all duration-200 active:scale-95 disabled:cursor-not-allowed"
            style={{
              backgroundColor: text.trim() ? "#1D9E75" : "#D1D5DB",
              opacity: text.trim() ? 1 : 0.55,
            }}
            data-testid="button-send-will-message"
          >
            <Send className="h-6 w-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
