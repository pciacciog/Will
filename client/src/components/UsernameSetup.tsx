import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { validateUsername } from "@shared/username";

export default function UsernameSetup() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<{ checking: boolean; available: boolean | null }>({
    checking: false,
    available: null,
  });
  const [saving, setSaving] = useState(false);
  const usernameCheck = validateUsername(username);

  useEffect(() => {
    if (username.length === 0 || !usernameCheck.valid) {
      setAvailability({ checking: false, available: null });
      return;
    }
    setAvailability({ checking: true, available: null });
    const t = setTimeout(async () => {
      try {
        const res = await apiRequest(`/api/users/username-available?u=${encodeURIComponent(usernameCheck.normalized)}`);
        const data = await res.json();
        setAvailability({ checking: false, available: !!data.available });
      } catch {
        setAvailability({ checking: false, available: null });
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const isUsernameOk = usernameCheck.valid && availability.available === true;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isUsernameOk || saving) return;
    setSaving(true);
    try {
      const res = await apiRequest("/api/user/username", {
        method: "PATCH",
        body: JSON.stringify({ username: usernameCheck.normalized }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setAvailability({ checking: false, available: false });
          toast({ title: "Username taken", description: "Please choose another.", variant: "destructive" });
        } else {
          toast({ title: "Couldn't save username", description: data.message || "Please try again.", variant: "destructive" });
        }
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      await queryClient.refetchQueries({ queryKey: ["/api/user"] });
    } catch {
      toast({
        title: "Network error",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="flex-1 flex flex-col justify-center px-6 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Choose your username</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              This is how friends find and recognize you on WILL. Pick something you'll keep.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="setup-username" className="text-xs font-medium">Username</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">@</span>
                <Input
                  id="setup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                  className="w-full pl-7 pr-3 py-2 border rounded-xl text-sm"
                  data-testid="input-setup-username"
                />
              </div>
              {username.length > 0 && (
                <p
                  className={`text-xs mt-1 ${
                    !usernameCheck.valid || availability.available === false
                      ? "text-red-500"
                      : availability.available === true
                      ? "text-emerald-600"
                      : "text-gray-400"
                  }`}
                  data-testid="text-setup-username-status"
                >
                  {!usernameCheck.valid
                    ? usernameCheck.reason
                    : availability.checking
                    ? "Checking availability…"
                    : availability.available === true
                    ? `@${usernameCheck.normalized} is available`
                    : availability.available === false
                    ? "That username is taken"
                    : ""}
                </p>
              )}
              <p className="text-[11px] text-gray-400 mt-2">
                3–30 characters · lowercase letters, numbers, and underscores.
              </p>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-2.5 rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 disabled:opacity-60"
              disabled={!isUsernameOk || saving}
              data-testid="button-save-username"
            >
              {saving ? "Saving…" : "Continue"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
