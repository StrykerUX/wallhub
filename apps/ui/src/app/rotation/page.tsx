"use client";
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, type Config, type IpcStatus } from "@/lib/tauri";
import Select from "@/components/Select";
import { LibraryPickerModal, SlotPicker } from "@/components/LibraryPicker";

// ─── Interval presets ─────────────────────────────────────────────────────────

const PRESETS = [
  { label: "5m",  minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "30m", minutes: 30 },
  { label: "1h",  minutes: 60 },
  { label: "2h",  minutes: 120 },
  { label: "4h",  minutes: 240 },
];

function IntervalPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const isPreset = PRESETS.some((p) => p.minutes === value);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customInput, setCustomInput] = useState(String(value));

  function pickPreset(minutes: number) {
    setCustomMode(false);
    onChange(minutes);
  }

  function applyCustom(raw: string) {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 1) onChange(n);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.minutes}
            type="button"
            onClick={() => pickPreset(p.minutes)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              !customMode && value === p.minutes
                ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setCustomMode(true); setCustomInput(String(value)); }}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            customMode
              ? "bg-[var(--accent)] border-[var(--accent)] text-white"
              : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]/40"
          }`}
        >
          Custom
        </button>
      </div>

      {customMode && (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onBlur={(e) => applyCustom(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCustom(customInput)}
            className="w-24 bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <span className="text-sm text-[var(--muted)]">minutes</span>
        </div>
      )}
    </div>
  );
}

// ─── Wallhaven filter chips (shared by pool=wallhaven and daily mode) ─────────

const RESOLUTIONS = [
  { value: "", label: "Any res" },
  { value: "1920x1080", label: "1080p" },
  { value: "2560x1440", label: "1440p" },
  { value: "3840x2160", label: "4K" },
];
const RATIOS = [
  { value: "", label: "Any ratio" },
  { value: "16x9", label: "16:9" },
  { value: "21x9", label: "21:9" },
  { value: "4x3", label: "4:3" },
];

interface WallhavenFiltersProps {
  categories?: string;
  purity?: string;
  atleast?: string;
  ratios?: string;
  hasApiKey: boolean;
  onChange: (patch: { categories?: string; purity?: string; atleast?: string; ratios?: string }) => void;
}

function WallhavenFilters({ categories, purity, atleast, ratios, hasApiKey, onChange }: WallhavenFiltersProps) {
  // Parse 3-bit masks (default: all categories, SFW only)
  const cats = categories ?? "111";
  const pur  = purity     ?? "100";

  const general = cats[0] === "1";
  const anime   = cats[1] === "1";
  const people  = cats[2] === "1";
  const sfw     = pur[0]  === "1";
  const sketchy = pur[1]  === "1";
  const nsfw    = pur[2]  === "1";

  function setCategories(g: boolean, a: boolean, p: boolean) {
    onChange({ categories: `${g?1:0}${a?1:0}${p?1:0}` });
  }
  function setPurity(s: boolean, sk: boolean, n: boolean) {
    onChange({ purity: `${s?1:0}${sk?1:0}${n?1:0}` });
  }

  const chip = (active: boolean, label: string, onClick: () => void, color = "accent") => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
        active
          ? color === "orange"
            ? "bg-orange-500/15 border-orange-500/50 text-orange-300"
            : "bg-[var(--accent)]/15 border-[var(--accent)]/50 text-[var(--accent)]"
          : "bg-transparent border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-[var(--muted)] w-16">Category</span>
        {chip(general, "General", () => setCategories(!general, anime, people))}
        {chip(anime,   "Anime",   () => setCategories(general, !anime, people))}
        {chip(people,  "People",  () => setCategories(general, anime, !people))}
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-[var(--muted)] w-16">Purity</span>
        {chip(sfw,     "SFW",     () => setPurity(!sfw, sketchy, nsfw))}
        {chip(sketchy, "Sketchy", () => setPurity(sfw, !sketchy, nsfw))}
        {hasApiKey && chip(nsfw, "NSFW", () => setPurity(sfw, sketchy, !nsfw), "orange")}
        {!hasApiKey && (
          <span className="text-xs text-[var(--muted)]/50" title="Requires API key">NSFW 🔒</span>
        )}
      </div>
      <div className="flex gap-2">
        <Select
          value={atleast ?? ""}
          onChange={(v) => onChange({ atleast: v || undefined })}
          options={RESOLUTIONS}
        />
        <Select
          value={ratios ?? ""}
          onChange={(v) => onChange({ ratios: v || undefined })}
          options={RATIOS}
        />
      </div>
    </div>
  );
}

// ─── Pool picker ──────────────────────────────────────────────────────────────

interface PoolPickerProps {
  pool: "local" | "wallhaven" | "selection";
  selectedPaths: string[];
  categories?: string;
  purity?: string;
  atleast?: string;
  ratios?: string;
  hasApiKey: boolean;
  onChange: (patch: Partial<Config["rotation"]>) => void;
}

function PoolPicker({ pool, selectedPaths, categories, purity, atleast, ratios, hasApiKey, onChange }: PoolPickerProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const poolBtn = (id: "local" | "wallhaven" | "selection", label: string, icon: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => onChange({ pool: id })}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
        pool === id
          ? "bg-[var(--accent)]/15 border-[var(--accent)]/60 text-[var(--accent)]"
          : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
      }`}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium block">Pool</label>
      <div className="flex flex-wrap gap-2">
        {poolBtn("local", "Local library",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
        )}
        {poolBtn("wallhaven", "Wallhaven",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
        )}
        {poolBtn("selection", "My selection",
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        )}
      </div>

      {pool === "wallhaven" && (
        <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
          <WallhavenFilters
            categories={categories} purity={purity} atleast={atleast} ratios={ratios}
            hasApiKey={hasApiKey}
            onChange={(patch) => onChange(patch)}
          />
        </div>
      )}

      {pool === "selection" && (
        <div className="space-y-2">
          {selectedPaths.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No images selected yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedPaths.map((p) => (
                <div key={p} className="relative rounded-md overflow-hidden border border-[var(--border)] group" style={{ width: 80, height: 45 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={convertFileSrc(p)} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => onChange({ selected_paths: selectedPaths.filter((x) => x !== p) })}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex items-center gap-1.5 text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--muted)] hover:text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            {selectedPaths.length === 0 ? "Add from library" : "Edit selection"}
          </button>
          <LibraryPickerModal
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            multi
            selected={selectedPaths}
            onSelect={(paths) => onChange({ selected_paths: paths })}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TIME_RANGES: Record<string, string> = {
  dawn:  "05:00 – 08:00",
  day:   "08:00 – 18:00",
  dusk:  "18:00 – 21:00",
  night: "21:00 – 05:00",
};

export default function RotationPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [status, setStatus] = useState<IpcStatus | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [starting, setStarting] = useState(false);

  async function load() {
    const [cfg, st] = await Promise.allSettled([api.getConfig(), api.getStatus()]);
    if (cfg.status === "fulfilled") {
      setConfig(cfg.value);
      setHasApiKey(!!cfg.value.api_key);
    }
    if (st.status === "fulfilled") setStatus(st.value);
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    try {
      await api.setRotationMode(config.rotation);
      // If rotation is active and daemon is running, apply immediately
      if (config.rotation.mode !== "disabled" && status) {
        await api.triggerNext().catch(() => {});
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
      load();
    }
  }

  async function triggerNext() {
    setTriggering(true);
    try { const st = await api.triggerNext(); setStatus(st); }
    finally { setTriggering(false); }
  }

  async function togglePause() {
    if (!status) return;
    const st = status.state === "paused" ? await api.resumeDaemon() : await api.pauseDaemon();
    setStatus(st);
  }

  async function startDaemon() {
    setStarting(true);
    try {
      await api.startDaemon();
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 800));
        const [, st] = await Promise.allSettled([Promise.resolve(), api.getStatus()]);
        if (st.status === "fulfilled") { setStatus(st.value); break; }
      }
    } finally { setStarting(false); }
  }

  function patchRotation(patch: Partial<Config["rotation"]>) {
    setConfig((c) => c ? { ...c, rotation: { ...c.rotation, ...patch } } : c);
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { mode } = config.rotation;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 max-w-2xl space-y-6">
        <h1 className="text-lg font-semibold">Wallpaper Rotation</h1>

        {/* Daemon status bar */}
        <div className="flex items-center gap-3 p-3 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
          <div className={`w-2 h-2 rounded-full shrink-0 ${
            status?.state === "active"  ? "bg-green-500 shadow-[0_0_6px_#22c55e]" :
            status?.state === "paused" ? "bg-yellow-500" : "bg-[var(--muted)]"
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              Daemon:{" "}
              <span className={`font-medium capitalize ${
                status?.state === "active"  ? "text-green-400" :
                status?.state === "paused" ? "text-yellow-400" : "text-[var(--muted)]"
              }`}>
                {status?.state ?? "offline"}
              </span>
              {status?.mode && status.mode !== "disabled" && (
                <span className="text-[var(--muted)]"> · {status.mode}</span>
              )}
            </p>
            {status?.next_at && (
              <p className="text-xs text-[var(--muted)]">Next: {new Date(status.next_at).toLocaleString()}</p>
            )}
          </div>
          {!status ? (
            <button onClick={startDaemon} disabled={starting}
              className="text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
              {starting ? "Starting…" : "Start daemon"}
            </button>
          ) : (
            <>
              <button onClick={triggerNext} disabled={triggering}
                className="text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors">
                {triggering ? "…" : "Apply now"}
              </button>
              <button onClick={togglePause}
                className="text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors">
                {status.state === "paused" ? "Resume" : "Pause"}
              </button>
            </>
          )}
        </div>

        {/* Mode selector */}
        <div>
          <label className="block text-sm font-medium mb-2">Mode</label>
          <div className="grid grid-cols-4 gap-2">
            {([
              { value: "disabled",    label: "Off" },
              { value: "time_of_day", label: "Time of day" },
              { value: "interval",    label: "Interval" },
              { value: "daily",       label: "Daily" },
            ] as const).map((m) => (
              <button key={m.value} type="button"
                onClick={() => patchRotation({ mode: m.value })}
                className={`py-2 text-sm rounded-lg border transition-colors ${
                  mode === m.value
                    ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Interval ── */}
        {mode === "interval" && (
          <div className="space-y-5 p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <div>
              <label className="text-sm font-medium block mb-2">Change every</label>
              <IntervalPicker
                value={config.rotation.interval_minutes}
                onChange={(v) => patchRotation({ interval_minutes: v })}
              />
            </div>
            <div className="border-t border-[var(--border)] pt-4">
              <PoolPicker
                pool={config.rotation.pool}
                selectedPaths={config.rotation.selected_paths}
                categories={config.rotation.categories}
                purity={config.rotation.purity}
                atleast={config.rotation.atleast}
                ratios={config.rotation.ratios}
                hasApiKey={hasApiKey}
                onChange={(patch) => patchRotation(patch)}
              />
            </div>
          </div>
        )}

        {/* ── Time of day ── */}
        {mode === "time_of_day" && (
          <div className="space-y-1 p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <p className="text-xs text-[var(--muted)] mb-4">
              Pick a wallpaper from your library for each part of the day.
            </p>
            {(["dawn", "day", "dusk", "night"] as const).map((slot) => (
              <div key={slot} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className="w-14 shrink-0">
                  <p className="text-sm font-medium capitalize">{slot}</p>
                  <p className="text-[10px] text-[var(--muted)]">{TIME_RANGES[slot]}</p>
                </div>
                <SlotPicker
                  value={config.time_of_day[slot]}
                  onChange={(path) =>
                    setConfig((c) =>
                      c ? { ...c, time_of_day: { ...c.time_of_day, [slot]: path } } : c
                    )
                  }
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Daily ── */}
        {mode === "daily" && (
          <div className="space-y-3 p-4 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
            <p className="text-sm text-[var(--muted)]">
              A new wallpaper is auto-downloaded from wallhaven at 6:00 AM each day.
            </p>
            <div className="border-t border-[var(--border)] pt-3">
              <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide mb-3">Wallhaven filters</p>
              <WallhavenFilters
                categories={config.rotation.categories}
                purity={config.rotation.purity}
                atleast={config.rotation.atleast}
                ratios={config.rotation.ratios}
                hasApiKey={hasApiKey}
                onChange={(patch) => patchRotation(patch)}
              />
            </div>
          </div>
        )}

        <button onClick={save} disabled={saving || saved}
          className={`flex items-center gap-2 text-sm rounded-lg px-5 py-2 transition-all disabled:opacity-70 ${
            saved
              ? "bg-green-600 text-white"
              : "bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
          }`}>
          {saved ? (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 7l3.5 3.5L12 3" />
              </svg>
              Saved & applied
            </>
          ) : saving ? "Saving…" : (
            config.rotation.mode !== "disabled" && status ? "Save & apply" : "Save"
          )}
        </button>
      </div>
    </div>
  );
}
