import { useLocation } from "wouter";
import { Target, Users, Globe, ArrowRight } from "lucide-react";

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
      setLocation("/create-team-will");
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
        className="relative w-full max-w-sm bg-white rounded-t-3xl px-5 pt-4 shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-10" />

        {/* Close button — text × avoids icon rendering issues on iOS */}
        <button
          onClick={onClose}
          className="absolute top-4 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 transition-all text-gray-500 font-medium"
          style={{ fontSize: "18px", lineHeight: 1 }}
          data-testid="button-close-who-modal"
          aria-label="Close"
        >
          ×
        </button>

        <div className="space-y-3 pb-2">

          {/* Solo Will — pre-selected by default */}
          <button
            onClick={() => handleChoice("solo")}
            className="w-full text-left group"
            data-testid="button-who-just-me"
          >
            <div className="relative flex items-center gap-4 bg-white border-2 border-emerald-400 rounded-2xl p-4 shadow-sm shadow-emerald-50 transition-all duration-200 group-active:scale-[0.98]">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Target className="w-6 h-6 text-emerald-600" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Solo Will</p>
                <p className="text-xs text-gray-500 mt-0.5">No one is watching... but you.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            </div>
          </button>

          {/* Team Will */}
          <button
            onClick={() => handleChoice("friends")}
            className="w-full text-left group"
            data-testid="button-who-friends"
          >
            <div className="relative flex items-center gap-4 bg-white border-2 border-gray-100 group-hover:border-violet-200 rounded-2xl p-4 transition-all duration-200 group-active:scale-[0.98]">
              <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-violet-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Team Will</p>
                <p className="text-xs text-gray-500 mt-0.5">Do great things. Together.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-violet-400 flex-shrink-0 transition-colors" />
            </div>
          </button>

          {/* Public Will */}
          <button
            onClick={() => handleChoice("public")}
            className="w-full text-left group"
            data-testid="button-who-everyone"
          >
            <div className="relative flex items-center gap-4 bg-white border-2 border-gray-100 group-hover:border-blue-200 rounded-2xl p-4 transition-all duration-200 group-active:scale-[0.98]">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Globe className="w-6 h-6 text-blue-500" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">Public Will</p>
                <p className="text-xs text-gray-500 mt-0.5">Maximum accountability. Inspire others.</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
