import { useState } from "react";

type AppMode = { mode: string; [key: string]: unknown };

export default function ActivationScreen({ onResolved }: { onResolved: (mode: AppMode) => void }) {
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"activate" | "trial" | null>(null);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading("activate");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const mode = await invoke<AppMode>("activate_license", { licenseKey: licenseKey.trim() });
      onResolved(mode);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleTrial(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading("trial");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const mode = await invoke<AppMode>("start_trial", { email: email.trim() });
      onResolved(mode);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <h1 className="text-xl font-bold text-center">CopilotMeet</h1>

        <form onSubmit={handleActivate} className="bg-white p-6 rounded-xl shadow-sm flex flex-col gap-3">
          <label className="text-sm font-medium">License Key</label>
          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="CPLT-XXXX-XXXX-XXXX"
            className="border rounded-lg px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="bg-black text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading === "activate" ? "Activating..." : "Activate"}
          </button>
        </form>

        <div className="text-center text-xs text-gray-400">OR</div>

        <form onSubmit={handleTrial} className="bg-white p-6 rounded-xl shadow-sm flex flex-col gap-3">
          <label className="text-sm font-medium">Start 7-Day Free Trial</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border rounded-lg px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={loading !== null}
            className="bg-primary text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading === "trial" ? "Starting..." : "Start Trial"}
          </button>
        </form>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}