import { useLocation } from "wouter";
import { Target, Users, Globe, X, ArrowRight } from "lucide-react";

interface WhoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhoModal({ isOpen, onClose }: WhoModalProps) {
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleChoice = (choice: "solo" | "friends" | "public") => {
    onClose();
    if (choice === "solo") {
      setLocation("/create-will");
    } else if (choice === "friends") {
      setLocation("/create-shared-will");
    } else {
      setLocation("/create-will?visibility=public");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-t-3xl px-5 pt-4 pb-8 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Who is this Will for?</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            data-testid="button-close-who-modal"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => handleChoice("solo")}
            className="w-full text-left group"
            data-testid="button-who-just-me"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
              <div className="relative flex items-center gap-4 bg-white border-2 border-emerald-100 group-hover:border-emerald-300 rounded-2xl p-4 transition-all duration-200 group-active:scale-[0.98]">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Target className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">Just Me</p>
                  <p className="text-xs text-gray-500 mt-0.5">Personal commitment, private or public</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0" />
              </div>
            </div>
          </button>

          <button
            onClick={() => handleChoice("friends")}
            className="w-full text-left group"
            data-testid="button-who-friends"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-400 to-purple-400 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
              <div className="relative flex items-center gap-4 bg-white border-2 border-violet-100 group-hover:border-violet-300 rounded-2xl p-4 transition-all duration-200 group-active:scale-[0.98]">
                <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-violet-600" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">Friends</p>
                  <p className="text-xs text-gray-500 mt-0.5">Invite friends to commit together</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-500 transition-colors flex-shrink-0" />
              </div>
            </div>
          </button>

          <button
            onClick={() => handleChoice("public")}
            className="w-full text-left group"
            data-testid="button-who-everyone"
          >
            <div className="relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-sky-400 rounded-2xl blur opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
              <div className="relative flex items-center gap-4 bg-white border-2 border-blue-100 group-hover:border-blue-300 rounded-2xl p-4 transition-all duration-200 group-active:scale-[0.98]">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Globe className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">Everyone</p>
                  <p className="text-xs text-gray-500 mt-0.5">Share publicly so others can join</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
