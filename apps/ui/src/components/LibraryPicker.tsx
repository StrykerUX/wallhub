"use client";
import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { api, type LocalWallpaper } from "@/lib/tauri";

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  multi?: boolean;
  selected: string[];
  onSelect: (paths: string[]) => void;
}

type Tab = "selected" | "all";

export function LibraryPickerModal({ open, onClose, multi = false, selected, onSelect }: ModalProps) {
  const [items, setItems] = useState<LocalWallpaper[]>([]);
  const [loading, setLoading] = useState(false);
  const [localSel, setLocalSel] = useState<string[]>([]);
  // Default to "selected" tab when editing an existing selection, "all" for fresh picks
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (!open) return;
    const currentSel = selected;
    setLocalSel(currentSel);
    // If there are already selected items, start on the "selected" tab
    setTab(multi && currentSel.length > 0 ? "selected" : "all");
    setLoading(true);
    api.getLibrary().then(setItems).finally(() => setLoading(false));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(path: string) {
    if (!multi) {
      onSelect([path]);
      onClose();
      return;
    }
    setLocalSel((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  }

  if (!open) return null;

  const visibleItems =
    tab === "selected"
      ? items.filter((i) => localSel.includes(i.path))
      : items;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface)] rounded-xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-1">
            {multi ? (
              <>
                {(["selected", "all"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      tab === t
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {t === "selected"
                      ? `In selection (${localSel.length})`
                      : `All library (${items.length})`}
                  </button>
                ))}
              </>
            ) : (
              <h3 className="text-sm font-semibold">Pick a wallpaper</h3>
            )}
          </div>

          <div className="flex items-center gap-2">
            {multi && (
              <button
                onClick={() => { onSelect(localSel); onClose(); }}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs rounded-lg px-3 py-1.5 transition-colors"
              >
                Done
              </button>
            )}
            <button
              onClick={onClose}
              className="text-[var(--muted)] hover:text-[var(--text)] transition-colors text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-12">
              {tab === "selected" ? (
                <>
                  <p className="text-[var(--muted)] text-sm">No images selected yet.</p>
                  <button
                    onClick={() => setTab("all")}
                    className="mt-2 text-xs text-[var(--accent)] hover:underline"
                  >
                    Browse all library →
                  </button>
                </>
              ) : (
                <p className="text-[var(--muted)] text-sm">
                  No wallpapers in library yet. Download some from Browse first.
                </p>
              )}
            </div>
          ) : (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
            >
              {visibleItems.map((item) => {
                const sel = localSel.includes(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => toggle(item.path)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all group ${
                      sel
                        ? "border-[var(--accent)]"
                        : "border-transparent hover:border-[var(--border)]"
                    }`}
                    style={{ aspectRatio: "16/9" }}
                    title={item.file_name}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={convertFileSrc(item.path)}
                      alt={item.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {sel && (
                      <div className="absolute inset-0 bg-[var(--accent)]/20 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-lg">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] truncate">{item.file_name}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single-slot picker (time-of-day) ─────────────────────────────────────────

interface SlotPickerProps {
  value?: string;
  onChange: (path: string | undefined) => void;
  placeholder?: string;
}

export function SlotPicker({ value, onChange, placeholder = "Pick wallpaper" }: SlotPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {value ? (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative rounded-md overflow-hidden shrink-0 border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
            style={{ width: 96, height: 54 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={convertFileSrc(value)} alt="" className="w-full h-full object-cover" />
          </button>
          <span className="text-xs text-[var(--muted)] truncate flex-1">
            {value.split("/").pop()}
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 text-[var(--muted)] hover:text-red-400 transition-colors text-sm px-1"
            title="Remove"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 border border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-lg text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors flex items-center justify-center gap-1 py-3"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {placeholder}
        </button>
      )}

      <LibraryPickerModal
        open={open}
        onClose={() => setOpen(false)}
        selected={value ? [value] : []}
        onSelect={([p]) => onChange(p)}
      />
    </>
  );
}
