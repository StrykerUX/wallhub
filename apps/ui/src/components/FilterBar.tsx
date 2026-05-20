"use client";
import { useState } from "react";
import type { SearchParams } from "@/lib/tauri";

interface Props {
  hasApiKey: boolean;
  onSearch: (params: SearchParams) => void;
}

const SORTINGS = [
  { value: "date_added", label: "Latest" },
  { value: "random", label: "Random" },
  { value: "toplist", label: "Top" },
  { value: "views", label: "Views" },
  { value: "favorites", label: "Favorites" },
];

const RESOLUTIONS = [
  { value: "", label: "Any" },
  { value: "1920x1080", label: "1080p" },
  { value: "2560x1440", label: "1440p" },
  { value: "3840x2160", label: "4K" },
];

const RATIOS = [
  { value: "", label: "Any" },
  { value: "16x9", label: "16:9" },
  { value: "21x9", label: "21:9" },
  { value: "4x3", label: "4:3" },
];

export default function FilterBar({ hasApiKey, onSearch }: Props) {
  const [q, setQ] = useState("");
  const [sorting, setSorting] = useState("date_added");
  const [atleast, setAtleast] = useState("1920x1080");
  const [ratios, setRatios] = useState("16x9");
  const [general, setGeneral] = useState(true);
  const [anime, setAnime] = useState(false);
  const [people, setPeople] = useState(false);
  const [nsfw, setNsfw] = useState(false);

  function buildParams(): SearchParams {
    const catBits = [general ? "1" : "0", anime ? "1" : "0", people ? "1" : "0"].join("");
    const purityBits = hasApiKey && nsfw ? "111" : "100";
    return {
      q: q || undefined,
      categories: catBits,
      purity: purityBits,
      sorting,
      atleast: atleast || undefined,
      ratios: ratios || undefined,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch(buildParams());
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] shrink-0 flex-wrap">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search wallpapers..."
        className="flex-1 min-w-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] text-[var(--text)] placeholder:text-[var(--muted)]"
      />

      <select
        value={sorting}
        onChange={(e) => setSorting(e.target.value)}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {SORTINGS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <select
        value={atleast}
        onChange={(e) => setAtleast(e.target.value)}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {RESOLUTIONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <select
        value={ratios}
        onChange={(e) => setRatios(e.target.value)}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
      >
        {RATIOS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      <div className="flex gap-2 text-xs text-[var(--muted)]">
        {[
          { label: "General", val: general, set: setGeneral },
          { label: "Anime", val: anime, set: setAnime },
          { label: "People", val: people, set: setPeople },
        ].map(({ label, val, set }) => (
          <label key={label} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={val}
              onChange={(e) => set(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            {label}
          </label>
        ))}
        {hasApiKey && (
          <label className="flex items-center gap-1 cursor-pointer text-orange-400">
            <input
              type="checkbox"
              checked={nsfw}
              onChange={(e) => setNsfw(e.target.checked)}
              className="accent-orange-400"
            />
            NSFW
          </label>
        )}
      </div>

      <button
        type="submit"
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg px-4 py-1.5 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
