"use client";
import { useEffect, useState } from "react";
import { api, type Config } from "@/lib/tauri";

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [geoCity, setGeoCity] = useState<string | null>(null);
  const [daemonLogs, setDaemonLogs] = useState<string>("");
  const [startingDaemon, setStartingDaemon] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig);
    api.getApiKey().then((k) => {
      setHasKey(!!k);
      if (k) setApiKey("••••••••");
    });
  }, []);

  async function saveKey() {
    setSavingKey(true);
    try {
      await api.saveApiKey(apiKey);
      setHasKey(true);
      setApiKey("••••••••");
    } finally {
      setSavingKey(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      await api.saveConfig(config);
    } finally {
      setSaving(false);
    }
  }

  async function detectLocation() {
    setDetecting(true);
    try {
      const result = await api.detectLocation();
      setGeoCity(result.city);
      setConfig((c) =>
        c ? { ...c, location: { lat: result.lat, lon: result.lon } } : c
      );
    } catch (e) {
      console.error(e);
    } finally {
      setDetecting(false);
    }
  }

  async function startDaemon() {
    setStartingDaemon(true);
    try {
      await api.startDaemon();
    } finally {
      setStartingDaemon(false);
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 max-w-2xl space-y-8">
        <h1 className="text-lg font-semibold">Settings</h1>

        {/* Wallhaven API key */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--muted)] uppercase tracking-wide">Wallhaven</h2>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="API key (optional)"
                value={apiKey}
                onFocus={() => { if (hasKey) setApiKey(""); }}
                onChange={(e) => setApiKey(e.target.value)}
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
              />
              <button
                onClick={saveKey}
                disabled={savingKey || !apiKey || apiKey === "••••••••"}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg px-4 py-1.5 transition-colors disabled:opacity-50"
              >
                {savingKey ? "Saving..." : "Save"}
              </button>
            </div>
            {hasKey && (
              <p className="text-xs text-green-400">API key saved in system keyring. Unlocks NSFW filter.</p>
            )}
            <p className="text-xs text-[var(--muted)]">
              Get your API key at{" "}
              <span className="text-[var(--accent)]">wallhaven.cc/settings/account</span>
            </p>
          </div>
        </section>

        {/* Location */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--muted)] uppercase tracking-wide">Location</h2>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <p className="text-xs text-[var(--muted)]">Used for sunrise/sunset in Time of Day mode.</p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Latitude"
                value={config.location.lat}
                onChange={(e) =>
                  setConfig((c) => c ? { ...c, location: { ...c.location, lat: +e.target.value } } : c)
                }
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <input
                type="number"
                placeholder="Longitude"
                value={config.location.lon}
                onChange={(e) =>
                  setConfig((c) => c ? { ...c, location: { ...c.location, lon: +e.target.value } } : c)
                }
                className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={detectLocation}
                disabled={detecting}
                className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] text-sm rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                {detecting ? "Detecting..." : "Auto-detect"}
              </button>
            </div>
            {geoCity && (
              <p className="text-xs text-green-400">Detected: {geoCity}</p>
            )}
          </div>
        </section>

        {/* General */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--muted)] uppercase tracking-wide">General</h2>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Apply to lock screen</span>
              <input
                type="checkbox"
                checked={config.general.apply_to_lock_screen}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, general: { ...c.general, apply_to_lock_screen: e.target.checked } } : c
                  )
                }
                className="w-4 h-4 accent-[var(--accent)]"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm">Convert to JPEG (recommended)</span>
              <input
                type="checkbox"
                checked={config.general.convert_to_jpeg}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, general: { ...c.general, convert_to_jpeg: e.target.checked } } : c
                  )
                }
                className="w-4 h-4 accent-[var(--accent)]"
              />
            </label>
            <div>
              <label className="text-sm block mb-1">Wallpaper directory</label>
              <input
                type="text"
                value={config.general.wallpaper_dir}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, general: { ...c.general, wallpaper_dir: e.target.value } } : c
                  )
                }
                className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        </section>

        {/* Daemon */}
        <section>
          <h2 className="text-sm font-semibold mb-3 text-[var(--muted)] uppercase tracking-wide">Daemon</h2>
          <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 space-y-3">
            <button
              onClick={startDaemon}
              disabled={startingDaemon}
              className="bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] text-sm rounded-lg px-4 py-1.5 transition-colors"
            >
              {startingDaemon ? "Starting..." : "Start daemon"}
            </button>
            <p className="text-xs text-[var(--muted)]">
              The daemon runs as a systemd user service (wallhub-daemon.service).
              It auto-installs itself on first launch.
            </p>
            <p className="text-xs text-[var(--muted)]">
              Check logs: <code className="bg-[var(--bg)] px-1 rounded">journalctl --user -u wallhub-daemon -f</code>
            </p>
          </div>
        </section>

        <button
          onClick={saveConfig}
          disabled={saving}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg px-5 py-2 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}
