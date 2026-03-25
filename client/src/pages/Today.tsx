import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft, X } from "lucide-react";

type TodayItem = {
  id: number;
  content: string;
  sortOrder: number;
};

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

function SwipeableItem({ item, onDelete }: { item: TodayItem; onDelete: () => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    const diff = e.touches[0].clientX - startXRef.current;
    currentXRef.current = diff;
    if (diff < 0) {
      setOffsetX(Math.max(diff, -100));
    }
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (currentXRef.current < -60) {
      onDelete();
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden" data-testid={`today-item-wrapper-${item.id}`}>
      <div
        className="absolute inset-y-0 right-0 w-24 bg-red-400 flex items-center justify-center"
        style={{ opacity: offsetX < -10 ? 1 : 0, transition: swiping ? "none" : "opacity 0.2s" }}
      >
        <X className="w-5 h-5 text-white" />
      </div>
      <div
        className="relative bg-[#FFFDF9] flex items-start gap-3 py-3 group"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <span className="text-gray-300 mt-0.5 select-none">—</span>
        <p className="flex-1 text-gray-800 text-[17px] leading-relaxed" data-testid={`text-today-item-${item.id}`}>
          {item.content}
        </p>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5"
          data-testid={`button-delete-item-${item.id}`}
          aria-label="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function Today() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const todayDate = getTodayDate();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery<TodayItem[]>({
    queryKey: [`/api/today/${todayDate}/items`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const addItemMutation = useMutation({
    mutationFn: async (content: string) => {
      const sortOrder = items.length;
      return apiRequest(`/api/today/${todayDate}/items`, {
        method: "POST",
        body: { content, sortOrder },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/today/${todayDate}/items`] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: number) => {
      return apiRequest(`/api/today/items/${itemId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/today/${todayDate}/items`] });
    },
  });

  useEffect(() => {
    if (!isLoading && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      addItemMutation.mutate(inputValue.trim());
      setInputValue("");
    }
  };

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

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900" data-testid="text-today-title">
              Today I will:
            </h1>
            <p className="text-sm text-gray-400 mt-0.5" data-testid="text-today-date">
              {formatDateDisplay(todayDate)}
            </p>
          </div>
        </div>

        <div className="flex-1 px-5 pb-4">
          <div className="space-y-0 divide-y divide-gray-100" data-testid="list-today-items">
            {(items || []).map((item) => (
              <SwipeableItem
                key={item.id}
                item={item}
                onDelete={() => deleteItemMutation.mutate(item.id)}
              />
            ))}
          </div>

          <div className="flex items-start gap-3 py-3">
            <span className="text-amber-400 mt-0.5 select-none">—</span>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={items.length === 0 ? "What's on your heart today..." : "Add another..."}
              className="flex-1 bg-transparent text-gray-800 text-[17px] leading-relaxed outline-none placeholder:text-gray-300 placeholder:italic"
              data-testid="input-today-new-item"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
