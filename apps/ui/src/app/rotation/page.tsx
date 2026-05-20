"use client";
import { useEffect, useState } from "react";
import { api, type Config, type IpcStatus } from "@/lib/tauri";
import Select from "@/components/Select";

export default function RotationPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<IpcStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);

  async function load() {
    const [cfg, st] = await Promise.allSettled([api.getConfig(), api.getStatus()]);
    if (cfg.status === "fulfilled") setConfig(cfg.value);
    if (st.status === "fulfilled") setStatus(st.value);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await api.setRotationMode(config.rotation);
    } finally {
      setSaving(false);
      load();
    }
  }

  async function triggerNext() {
    setTriggering(true);
    try {
      const st = await api.triggerNext();
      setStatus(st);
    } finally {
      setTriggering(false);
    }
  }

  async function togglePause() {
    if (!status) return;
    const st = status.state === "paused"
      ? await api.resumeDaemon()
      : await api.pauseDaemon();
    setStatus(st);
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const mode = config.rotation.mode;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 max-w-2xl">
        <h1 className="text-lg font-semibold mb-1">Wallpaper Rotation</h1>

        {/* Daemon status */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className={`w-2 h-2 rounded-full ${status?.state === "active" ? "bg-green-500" : "bg-[var(--muted)]"}`} />
          <div className="flex-1">
            <p className="text-sm">
              Daemon: <span className="font-medium capitalize">{status?.state ?? "offline"}</span>
              {status?.mode && status.mode !== "disabled" && (
                <span className="text-[var(--muted)]"> · {status.mode}</span>
              )}
            </p>
            {status?.next_at && (
              <p className="text-xs text-[var(--muted)]">
                Next: {new Date(status.next_at).toLocaleString()}
              </p>
            )}
          </div>
          <button
            onClick={triggerNext}
            disabled={triggering}
            className="text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
          >
            {triggering ? "..." : "Apply now"}
          </button>
          <button
            onClick={togglePause}
            className="text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
          >
            {status?.state === "paused" ? "Resume" : "Pause"}
          </button>
        </div>

        {/* Mode selector */}
        <label className="block text-sm font-medium mb-2">Mode</label>
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { value: "disabled", label: "Off" },
            { value: "time_of_day", label: "Time of day" },
            { value: "interval", label: "Interval" },
            { value: "daily", label: "Daily" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() =>
                setConfig((c) =>
                  c ? { ...c, rotation: { ...c.rotation, mode: m.value as typeof mode } } : c
                )
              }
              className={`py-2 text-sm rounded-lg border transition-colors ${
                mode === m.value
                  ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                  : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Interval options */}
        {mode === "interval" && (
          <div className="mb-6 space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">
                Change every {config.rotation.interval_minutes} min
              </label>
              <input
                type="range"
                min={5}
                max={1440}
                step={5}
                value={config.rotation.interval_minutes}
                onChange={(e) =>
                  setConfig((c) =>
                    c ? { ...c, rotation: { ...c.rotation, interval_minutes: +e.target.value } } : c
                  )
                }
                className="w-full accent-[var(--accent)]"
              />
              <div className="flex justify-between text-xs text-[var(--muted)] mt-1">
                <span>5 min</span>
                <span>24 h</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Pool</label>
              <Select
                value={config.rotation.pool}
                onChange={(pool) =>
                  setConfig((c) =>
                    c ? { ...c, rotation: { ...c.rotation, pool } } : c
                  )
                }
                options={[
                  { value: "local", label: "Local library" },
                  { value: "wallhaven", label: "wallhaven (random)" },
                ]}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Time of day options */}
        {mode === "time_of_day" && (
          <div className="mb-6 space-y-3">
            <p className="text-xs text-[var(--muted)]">
              Assign a wallpaper from your library for each part of the day.
              Times are calculated from your location (sunrise/sunset).
            </p>
            {(["dawn", "day", "dusk", "night"] as const).map((slot) => (
              <div key={slot} className="flex items-center gap-3">
                <span className="text-sm capitalize w-12">{slot}</span>
                <input
                  type="text"
                  placeholder="/path/to/wallpaper.jpg"
                  value={config.time_of_day[slot] ?? ""}
                  onChange={(e) =>
                    setConfig((c) =>
                      c
                        ? { ...c, time_of_day: { ...c.time_of_day, [slot]: e.target.value || undefined } }
                        : c
                    )
                  }
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]"
                />
              </div>
            ))}
          </div>
        )}

        {/* Daily options */}
        {mode === "daily" && (
          <div className="mb-6 p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              A new wallpaper is auto-downloaded from wallhaven at 6:00 AM each day
              using your saved filters (resolution, ratio, category).
            </p>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={save}
          disabled={saving}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg px-5 py-2 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save rotation config"}
        </button>
      </div>
    </div>
  );
}
