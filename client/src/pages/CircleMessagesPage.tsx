import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft } from "lucide-react";
import CircleMessages from "@/components/CircleMessages";

interface CircleMessagesPageProps {
  circleId: number;
}

export default function CircleMessagesPage({ circleId }: CircleMessagesPageProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      <div className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom))] min-h-screen flex flex-col">
        <div className="max-w-sm mx-auto px-5 w-full flex flex-col flex-1" style={{ minHeight: 0 }}>

          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setLocation(`/circles/${circleId}`)}
              className="w-11 h-11 -ml-2 flex items-center justify-center"
              data-testid="button-back-circle"
              aria-label="Back to Circle"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-200 text-gray-700 hover:text-gray-900 hover:bg-gray-200 hover:border-gray-300 transition-all duration-200 active:scale-95">
                <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
              </span>
            </button>

            <div className="flex-1 text-center">
              <h1 className="text-lg font-semibold text-gray-900" data-testid="text-messages-title">Messages</h1>
            </div>

            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <span className="text-white font-semibold text-sm" data-testid="text-user-initial">
                {user.firstName?.charAt(0) || user.email?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
          </div>

          <div className="flex-1 bg-white rounded-2xl shadow-xl border-0 overflow-hidden" style={{ minHeight: 0 }}>
            <CircleMessages circleId={circleId} currentUserId={user.id} />
          </div>

        </div>
      </div>
    </div>
  );
}
