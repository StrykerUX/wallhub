"use client";
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, type LocalWallpaper, type WallpaperTarget } from "@/lib/tauri";

type Tab = "all" | "downloaded" | "daily" | "local";

export default function LibraryPage() {
  const [items, setItems] = useState<LocalWallpaper[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await api.getLibrary());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = tab === "all" ? items : items.filter((i) => i.source === tab);

  async function apply(path: string, target: WallpaperTarget) {
    setApplying(path);
    try {
      await api.setWallpaper(path, target);
    } finally {
      setApplying(null);
    }
  }

  const tabs: Tab[] = ["all", "downloaded", "daily", "local"];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-3 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
              tab === t
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={load}
          className="text-xs text-[var(--muted)] hover:text-[var(--text)] px-2"
        >
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
            No wallpapers in this collection yet.
          </div>
        )}

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {filtered.map((item) => (
            <div
              key={item.path}
              className="relative rounded-lg overflow-hidden bg-[var(--surface)] group"
              style={{ aspectRatio: "16/9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={convertFileSrc(item.path)}
                alt={item.file_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1">
                <p className="text-xs text-white/70 truncate">{item.file_name}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => apply(item.path, "desktop")}
                    disabled={applying === item.path}
                    className="flex-1 text-xs bg-[var(--surface)]/80 hover:bg-[var(--accent)] text-white rounded px-2 py-1 transition-colors"
                  >
                    Desktop
                  </button>
                  <button
                    onClick={() => apply(item.path, "lock_screen")}
                    disabled={applying === item.path}
                    className="flex-1 text-xs bg-[var(--surface)]/80 hover:bg-[var(--accent)] text-white rounded px-2 py-1 transition-colors"
                  >
                    Lock
                  </button>
                  <button
                    onClick={() => apply(item.path, "both")}
                    disabled={applying === item.path}
                    className="flex-1 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded px-2 py-1 transition-colors"
                  >
                    {applying === item.path ? "..." : "Both"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
