"use client";
import { useState } from "react";
import type { Wallpaper, WallpaperTarget } from "@/lib/tauri";
import { api } from "@/lib/tauri";

interface Props {
  wallpaper: Wallpaper;
  onApplied?: () => void;
}

export default function WallpaperCard({ wallpaper, onApplied }: Props) {
  const [hovering, setHovering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function apply(target: WallpaperTarget) {
    setLoading(true);
    setApplyError(null);
    try {
      await api.download(wallpaper.id, wallpaper.path, target);
      onApplied?.();
      setShowModal(false);
    } catch (e) {
      setApplyError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className="relative rounded-lg overflow-hidden cursor-pointer group"
        style={{ aspectRatio: "16/9" }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => setShowModal(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wallpaper.thumbs.large}
          alt={wallpaper.id}
          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />

        {/* Overlay */}
        {hovering && (
          <div className="absolute inset-0 bg-black/50 flex flex-col justify-end p-2 gap-1">
            <p className="text-xs text-white/70">{wallpaper.resolution}</p>
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); apply("both"); }}
                disabled={loading}
                className="flex-1 text-xs bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded px-2 py-1 transition-colors"
              >
                {loading ? "..." : "Set"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); api.download(wallpaper.id, wallpaper.path); }}
                className="text-xs bg-white/10 hover:bg-white/20 text-white rounded px-2 py-1 transition-colors"
              >
                ↓
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[var(--surface)] rounded-xl overflow-hidden max-w-3xl w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wallpaper.thumbs.original}
              alt={wallpaper.id}
              className="w-full object-contain max-h-96"
            />
            <div className="p-4 flex flex-col gap-3">
              {applyError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{applyError}</p>
              )}
              <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--muted)]">
                  {wallpaper.resolution} · {wallpaper.ratio} · {wallpaper.file_type.split("/")[1]?.toUpperCase()}
                </p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {wallpaper.views.toLocaleString()} views · {wallpaper.favorites.toLocaleString()} favs
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => apply("desktop")}
                  disabled={loading}
                  className="text-sm bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
                >
                  Desktop
                </button>
                <button
                  onClick={() => apply("lock_screen")}
                  disabled={loading}
                  className="text-sm bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
                >
                  Lock
                </button>
                <button
                  onClick={() => apply("both")}
                  disabled={loading}
                  className="text-sm bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg px-3 py-1.5 transition-colors"
                >
                  {loading ? "Applying..." : "Set Both"}
                </button>
              </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
