import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft, X } from "lucide-react";

type TodayItem = {
  id: number;
  content: string;
  sortOrder: number;
  checked: boolean;
};

type Tab = "today" | "tomorrow";

function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTomorrowDate(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
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

const SwipeableItem = memo(function SwipeableItem({
  item,
  onDelete,
  onToggle,
}: {
  item: TodayItem;
  onDelete: () => void;
  onToggle: (checked: boolean) => void;
}) {
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
    <div
      className="relative overflow-hidden"
      style={{ borderBottom: "0.5px solid #f0ece6" }}
      data-testid={`today-item-wrapper-${item.id}`}
    >
      <div
        className="absolute inset-y-0 right-0 w-24 bg-red-400 flex items-center justify-center"
        style={{ opacity: offsetX < -10 ? 1 : 0, transition: swiping ? "none" : "opacity 0.2s" }}
      >
        <X className="w-5 h-5 text-white" />
      </div>

      <div
        className="relative bg-[#FFFDF9] flex items-center gap-3 group"
        style={{
          paddingTop: 14,
          paddingBottom: 14,
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={() => onToggle(!item.checked)}
          className="flex-shrink-0 rounded-full focus:outline-none"
          style={{
            width: 15,
            height: 15,
            border: `1px solid ${item.checked ? "#E9A84C" : "#D1D5DB"}`,
            backgroundColor: item.checked ? "#E9A84C" : "transparent",
            transform: item.checked ? "scale(1.08)" : "scale(1)",
            transition: "background-color 0.35s ease, border-color 0.35s ease, transform 0.2s ease",
          }}
          data-testid={`button-check-item-${item.id}`}
          aria-label={item.checked ? "Unacknowledge" : "Acknowledge"}
        />

        <div className="relative flex-1 overflow-hidden">
          <p
            className="text-[17px] leading-relaxed"
            style={{
              color: item.checked ? "#9CA3AF" : "#1F2937",
              opacity: item.checked ? 0.6 : 1,
              transition: "color 0.5s ease, opacity 0.5s ease",
            }}
            data-testid={`text-today-item-${item.id}`}
          >
            {item.content}
          </p>
          <span
            className="absolute left-0 pointer-events-none"
            style={{
              top: "50%",
              height: "1px",
              backgroundColor: "#9CA3AF",
              width: item.checked ? "100%" : "0%",
              transition: item.checked
                ? "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)"
                : "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>

        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-300 hover:text-red-400 flex-shrink-0"
          data-testid={`button-delete-item-${item.id}`}
          aria-label="Remove"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

function AddIntentionInput({
  activeTab,
  activeDate,
  itemCount,
  onAdd,
  focusTrigger,
}: {
  activeTab: Tab;
  activeDate: string;
  itemCount: number;
  onAdd: (content: string, date: string) => void;
  focusTrigger: number;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, [focusTrigger]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && value.trim()) {
      e.preventDefault();
      onAdd(value.trim(), activeDate);
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-3" style={{ paddingTop: 14, paddingBottom: 14 }}>
      <span style={{ width: 15, height: 15, flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          itemCount === 0
            ? activeTab === "today"
              ? "What's on your heart today..."
              : "What will you do tomorrow..."
            : "Add another..."
        }
        className="flex-1 bg-transparent text-gray-800 text-[17px] leading-relaxed outline-none placeholder:text-gray-300 placeholder:italic"
        data-testid="input-today-new-item"
      />
    </div>
  );
}

export default function Today() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [focusTrigger, setFocusTrigger] = useState(0);
  const queryClient = useQueryClient();

  const todayDate = getTodayDate();
  const tomorrowDate = getTomorrowDate();
  const activeDate = activeTab === "today" ? todayDate : tomorrowDate;

  const { data: items = [], isLoading } = useQuery<TodayItem[]>({
    queryKey: [`/api/today/${activeDate}/items`],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ content, date }: { content: string; date: string }) => {
      const currentItems = queryClient.getQueryData<TodayItem[]>([`/api/today/${date}/items`]) || [];
      return apiRequest(`/api/today/${date}/items`, {
        method: "POST",
        body: { content, sortOrder: currentItems.length },
      });
    },
    onSuccess: (_data, { date }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/today/${date}/items`] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: number; date: string }) => {
      return apiRequest(`/api/today/items/${itemId}`, { method: "DELETE" });
    },
    onSuccess: (_data, { date }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/today/${date}/items`] });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: number; checked: boolean; date: string }) => {
      return apiRequest(`/api/today/items/${itemId}/toggle`, {
        method: "PATCH",
        body: { checked },
      });
    },
    onMutate: async ({ itemId, checked, date }) => {
      const key = [`/api/today/${date}/items`];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TodayItem[]>(key);
      queryClient.setQueryData<TodayItem[]>(key, (old) =>
        (old || []).map((item) => (item.id === itemId ? { ...item, checked } : item))
      );
      return { previous, date };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous && context.date) {
        queryClient.setQueryData([`/api/today/${context.date}/items`], context.previous);
      }
    },
  });

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    setFocusTrigger((n) => n + 1);
  };

  const handleAdd = useCallback((content: string, date: string) => {
    addItemMutation.mutate({ content, date });
  }, []);

  const handleDelete = useCallback((itemId: number, date: string) => {
    deleteItemMutation.mutate({ itemId, date });
  }, []);

  const handleToggle = useCallback((itemId: number, checked: boolean, date: string) => {
    toggleItemMutation.mutate({ itemId, checked, date });
  }, []);

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col">
      <div className="pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col flex-1">
        <div className="px-5 pt-4 pb-3">
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
              I will<span style={{ color: "#E9A84C" }}>:</span>
            </h1>
          </div>

          <p className="text-sm text-gray-400 mb-4" data-testid="text-today-date">
            {formatDateDisplay(activeDate)}
          </p>

          <div
            className="flex rounded-full p-[3px]"
            style={{ backgroundColor: "#f0ece6" }}
            data-testid="toggle-today-tomorrow"
          >
            <button
              onClick={() => handleTabSwitch("today")}
              className="flex-1 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={
                activeTab === "today"
                  ? { backgroundColor: "white", color: "#1F2937", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "#9CA3AF" }
              }
              data-testid="tab-today"
            >
              Today
            </button>
            <button
              onClick={() => handleTabSwitch("tomorrow")}
              className="flex-1 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={
                activeTab === "tomorrow"
                  ? { backgroundColor: "white", color: "#1F2937", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "#9CA3AF" }
              }
              data-testid="tab-tomorrow"
            >
              Tomorrow
            </button>
          </div>
        </div>

        <div className="flex-1 px-5 pb-4">
          <div data-testid="list-today-items">
            {items.map((item) => (
              <SwipeableItem
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id, activeDate)}
                onToggle={(checked) => handleToggle(item.id, checked, activeDate)}
              />
            ))}
          </div>

          <AddIntentionInput
            activeTab={activeTab}
            activeDate={activeDate}
            itemCount={items.length}
            onAdd={handleAdd}
            focusTrigger={focusTrigger}
          />
        </div>
      </div>
    </div>
  );
}
