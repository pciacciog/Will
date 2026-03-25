import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft } from "lucide-react";

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function Today() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const todayDate = getTodayDate();

  const { data: entry, isLoading } = useQuery<{ content: string; date: string }>({
    queryKey: [`/api/today/${todayDate}`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  useEffect(() => {
    if (entry && entry.content !== undefined) {
      setContent(entry.content);
    }
  }, [entry]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const saveContent = useCallback(async (text: string) => {
    if (!user) return;
    setIsSaving(true);
    try {
      await apiRequest(`/api/today/${todayDate}`, {
        method: "PUT",
        body: { content: text },
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error("Failed to save today entry:", error);
    } finally {
      setIsSaving(false);
    }
  }, [user, todayDate]);

  const latestContentRef = useRef(content);
  latestContentRef.current = content;

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      saveContent(latestContentRef.current);
    }
  }, [saveContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      saveContent(newContent);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        saveContent(latestContentRef.current);
      }
    };
  }, [saveContent]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col">
      <div className="pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col flex-1">
        <div className="px-5 pt-4 pb-2">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors mb-4"
            data-testid="button-back-home"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">Home</span>
          </button>

          <div className="mb-1">
            <h1 className="text-2xl font-semibold text-gray-900" data-testid="text-today-title">
              Today
            </h1>
            <p className="text-sm text-gray-400 mt-0.5" data-testid="text-today-date">
              {formatDateDisplay(todayDate)}
            </p>
          </div>
        </div>

        <div className="flex-1 px-5 pb-4 flex flex-col">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            placeholder="What's on your heart today..."
            className="flex-1 w-full bg-transparent text-gray-800 text-[17px] leading-relaxed resize-none outline-none placeholder:text-gray-300 placeholder:italic"
            style={{ minHeight: "60vh" }}
            data-testid="input-today-content"
          />
          
          <div className="flex items-center justify-end pt-2">
            {isSaving && (
              <span className="text-xs text-gray-300" data-testid="text-saving-status">
                Saving...
              </span>
            )}
            {!isSaving && lastSaved && (
              <span className="text-xs text-gray-300" data-testid="text-saved-status">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}