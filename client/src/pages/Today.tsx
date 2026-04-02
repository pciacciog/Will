import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { X, Check } from "lucide-react";
import { UnifiedBackButton } from "@/components/ui/design-system";

type TodayItem = {
  id: number;
  content: string;
  sortOrder: number;
  checked: boolean;
  context: string;
};

type Tab = "today" | "tomorrow";
type Context = "personal" | "work";

const CONTEXT_COLORS: Record<Context, string> = {
  personal: "#1a9e75",
  work: "#4a7fd4",
};

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
  context,
  onDelete,
  onToggle,
}: {
  item: TodayItem;
  context: Context;
  onDelete: () => void;
  onToggle: (checked: boolean) => void;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const activeColor = CONTEXT_COLORS[context];

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
          className="flex-shrink-0 rounded-full focus:outline-none flex items-center justify-center"
          style={{
            width: 15,
            height: 15,
            border: `1px solid ${item.checked ? activeColor : "#D1D5DB"}`,
            backgroundColor: item.checked ? activeColor : "transparent",
            transform: item.checked ? "scale(1.08)" : "scale(1)",
            transition: "background-color 0.35s ease, border-color 0.35s ease, transform 0.2s ease",
          }}
          data-testid={`button-check-item-${item.id}`}
          aria-label={item.checked ? "Unacknowledge" : "Acknowledge"}
        >
          {item.checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>

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
  context,
  itemCount,
  onAdd,
  focusTrigger,
}: {
  activeTab: Tab;
  activeDate: string;
  context: Context;
  itemCount: number;
  onAdd: (content: string, date: string, context: Context) => void;
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
      onAdd(value.trim(), activeDate, context);
      setValue("");
    }
  };

  const placeholder =
    itemCount === 0
      ? context === "work"
        ? "Add a work intention..."
        : activeTab === "today"
        ? "What's on your heart today..."
        : "What will you do tomorrow..."
      : context === "work"
      ? "Add a work intention..."
      : "Add another...";

  return (
    <div className="flex items-center gap-3" style={{ paddingTop: 14, paddingBottom: 14 }}>
      <span style={{ width: 15, height: 15, flexShrink: 0 }} />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
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
  const [context, setContext] = useState<Context>(() => {
    return (localStorage.getItem("today_context") as Context) ?? "personal";
  });
  const [focusTrigger, setFocusTrigger] = useState(0);
  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem("today_context", context);
  }, [context]);

  const todayDate = getTodayDate();
  const tomorrowDate = getTomorrowDate();
  const activeDate = activeTab === "today" ? todayDate : tomorrowDate;

  const { data: items = [], isLoading } = useQuery<TodayItem[]>({
    queryKey: ["/api/today", activeDate, context, "items"],
    queryFn: async () => {
      const r = await apiRequest(`/api/today/${activeDate}/items?context=${context}`);
      return r.json();
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ content, date, ctx }: { content: string; date: string; ctx: Context }) => {
      const currentItems = queryClient.getQueryData<TodayItem[]>(["/api/today", date, ctx, "items"]) || [];
      return apiRequest(`/api/today/${date}/items`, {
        method: "POST",
        body: { content, sortOrder: currentItems.length, context: ctx },
      });
    },
    onSuccess: (_data, { date, ctx }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/today", date, ctx, "items"] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: number; date: string; ctx: Context }) => {
      return apiRequest(`/api/today/items/${itemId}`, { method: "DELETE" });
    },
    onSuccess: (_data, { date, ctx }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/today", date, ctx, "items"] });
    },
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({ itemId, checked }: { itemId: number; checked: boolean; date: string; ctx: Context }) => {
      return apiRequest(`/api/today/items/${itemId}/toggle`, {
        method: "PATCH",
        body: { checked },
      });
    },
    onMutate: async ({ itemId, checked, date, ctx }) => {
      const key = ["/api/today", date, ctx, "items"];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TodayItem[]>(key);
      queryClient.setQueryData<TodayItem[]>(key, (old) =>
        (old || []).map((item) => (item.id === itemId ? { ...item, checked } : item))
      );
      return { previous, date, ctx };
    },
    onError: (_err, _vars, rollback) => {
      if (rollback?.previous) {
        queryClient.setQueryData(["/api/today", rollback.date, rollback.ctx, "items"], rollback.previous);
      }
    },
  });

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    setFocusTrigger((n) => n + 1);
  };

  const handleContextSwitch = (ctx: Context) => {
    setContext(ctx);
    setFocusTrigger((n) => n + 1);
  };

  const handleAdd = useCallback((content: string, date: string, ctx: Context) => {
    addItemMutation.mutate({ content, date, ctx });
  }, []);

  const handleDelete = useCallback((itemId: number, date: string, ctx: Context) => {
    deleteItemMutation.mutate({ itemId, date, ctx });
  }, []);

  const handleToggle = useCallback((itemId: number, checked: boolean, date: string, ctx: Context) => {
    toggleItemMutation.mutate({ itemId, checked, date, ctx });
  }, []);

  if (isLoading && items.length === 0) {
    return (
      <div className="min-h-screen bg-[#FFFDF9] flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  const activeColor = CONTEXT_COLORS[context];

  return (
    <div className="h-[100dvh] bg-[#FFFDF9] flex flex-col overflow-hidden">
      {/* Safe area top */}
      <div style={{ height: "calc(env(safe-area-inset-top, 0px) + 0.75rem)", flexShrink: 0 }} />

      {/* Nav bar */}
      <div className="px-4 flex items-center justify-between mb-2 min-h-[44px] flex-shrink-0">
        <UnifiedBackButton
          onClick={() => setLocation("/")}
          testId="button-back-home"
        />
        <h1 className="absolute left-0 right-0 text-center text-xl font-semibold pointer-events-none" data-testid="text-today-title">
          I Will<span style={{ color: "#E9A84C" }}>:</span>
        </h1>
        <div className="w-11" />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-sm text-gray-400 mb-4 mt-1" data-testid="text-today-date">
          {formatDateDisplay(activeDate)}
        </p>

        {/* Today / Tomorrow pill toggle */}
        <div
          className="flex rounded-full p-[3px] mb-4"
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

        {/* Items list */}
        <div data-testid="list-today-items">
          {items.map((item) => (
            <SwipeableItem
              key={item.id}
              item={item}
              context={context}
              onDelete={() => handleDelete(item.id, activeDate, context)}
              onToggle={(checked) => handleToggle(item.id, checked, activeDate, context)}
            />
          ))}
        </div>

        <AddIntentionInput
          activeTab={activeTab}
          activeDate={activeDate}
          context={context}
          itemCount={items.length}
          onAdd={handleAdd}
          focusTrigger={focusTrigger}
        />

        {/* Bottom padding so last item clears the footer */}
        <div style={{ height: 80 }} />
      </div>

      {/* Fixed footer — Personal / Work toggle */}
      <div
        className="flex-shrink-0"
        style={{
          background: "#FFFDF9",
          borderTop: "1px solid #e8e6e0",
          padding: "8px 14px 18px",
          paddingBottom: `calc(18px + env(safe-area-inset-bottom, 0px))`,
        }}
      >
        <div
          className="flex rounded-full"
          style={{ backgroundColor: "#eeece6", padding: 4, borderRadius: 30 }}
          data-testid="toggle-personal-work"
        >
          <button
            onClick={() => handleContextSwitch("personal")}
            className="flex-1 transition-all duration-200"
            style={{
              borderRadius: 26,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: context === "personal" ? 600 : 500,
              color: context === "personal" ? "white" : "#aaa",
              backgroundColor: context === "personal" ? CONTEXT_COLORS.personal : "transparent",
              boxShadow: context === "personal" ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              border: "none",
              cursor: "pointer",
            }}
            data-testid="tab-personal"
          >
            Personal
          </button>
          <button
            onClick={() => handleContextSwitch("work")}
            className="flex-1 transition-all duration-200"
            style={{
              borderRadius: 26,
              padding: "9px 0",
              fontSize: 13,
              fontWeight: context === "work" ? 600 : 500,
              color: context === "work" ? "white" : "#aaa",
              backgroundColor: context === "work" ? CONTEXT_COLORS.work : "transparent",
              boxShadow: context === "work" ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
              border: "none",
              cursor: "pointer",
            }}
            data-testid="tab-work"
          >
            Work
          </button>
        </div>
      </div>
    </div>
  );
}
