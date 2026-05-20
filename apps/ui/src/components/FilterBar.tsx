"use client";
import { useState } from "react";
import type { SearchParams } from "@/lib/tauri";
import Select from "@/components/Select";

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

// ─── Category icons ───────────────────────────────────────────────────────────

function IconGeneral({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Mountain landscape */}
      <path d="M3 20 L8 10 L13 16 L16 12 L21 20 Z" />
      <circle cx="18" cy="7" r="2.5" />
    </svg>
  );
}

function IconAnime({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Star sparkle */}
      <path d="M12 2 L13.8 8.2 L20 9 L15.4 13.4 L16.8 20 L12 16.8 L7.2 20 L8.6 13.4 L4 9 L10.2 8.2 Z" />
    </svg>
  );
}

function IconPeople({ active }: { active: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Person */}
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21 C4 17 7.6 14 12 14 C16.4 14 20 17 20 21" />
    </svg>
  );
}

function IconNSFW() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* Flame */}
      <path d="M12 2 C12 2 16 6 16 10 C16 12 15 13.5 13.5 14.5 C14 13 13.5 11.5 12.5 11 C12.5 12.5 11.5 13.5 10.5 14 C9 13 8 11.5 8 10 C8 8 9 6.5 9 6.5 C9 6.5 8.5 8 9.5 9 C9.8 7 11 4.5 12 2 Z" />
      <path d="M12 22 C9.2 22 7 19.8 7 17 C7 15 8 13.5 9.5 12.5 C9.2 13.5 9.5 14.5 10.5 15 C10.5 14 11 13 12 12.5 C13 13 13.5 14 13.5 15 C14.5 14.5 14.8 13.5 14.5 12.5 C16 13.5 17 15 17 17 C17 19.8 14.8 22 12 22 Z" />
    </svg>
  );
}

// ─── Category chip ─────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  variant?: "default" | "nsfw";
  disabled?: boolean;
  title?: string;
}

function CategoryChip({ label, active, onClick, icon, variant = "default", disabled, title }: ChipProps) {
  const isNsfw = variant === "nsfw";

  const base = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 select-none";

  const activeStyle = isNsfw
    ? "bg-orange-500/20 border-orange-500/60 text-orange-300"
    : "bg-[var(--accent)]/15 border-[var(--accent)]/60 text-[var(--accent)]";

  const inactiveStyle = disabled
    ? "bg-transparent border-[var(--border)] text-[var(--muted)]/40 cursor-not-allowed opacity-50"
    : isNsfw
      ? "bg-transparent border-[var(--border)] text-[var(--muted)] hover:border-orange-500/40 hover:text-orange-400 cursor-pointer"
      : "bg-transparent border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]/40 hover:text-[var(--text)] cursor-pointer";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      title={title}
      className={`${base} ${active ? activeStyle : inactiveStyle}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

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
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)] shrink-0 flex-wrap"
    >
      {/* Search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search wallpapers..."
        className="flex-1 min-w-40 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] text-[var(--text)] placeholder:text-[var(--muted)]"
      />

      {/* Filters */}
      <Select value={sorting} onChange={setSorting} options={SORTINGS} />
      <Select value={atleast} onChange={setAtleast} options={RESOLUTIONS} />
      <Select value={ratios} onChange={setRatios} options={RATIOS} />

      {/* Separator */}
      <div className="w-px h-6 bg-[var(--border)] mx-0.5" />

      {/* Category chips */}
      <div className="flex items-center gap-1.5">
        <CategoryChip
          label="General"
          active={general}
          onClick={() => setGeneral((v) => !v)}
          icon={<IconGeneral active={general} />}
        />
        <CategoryChip
          label="Anime"
          active={anime}
          onClick={() => setAnime((v) => !v)}
          icon={<IconAnime active={anime} />}
        />
        <CategoryChip
          label="People"
          active={people}
          onClick={() => setPeople((v) => !v)}
          icon={<IconPeople active={people} />}
        />

        {/* NSFW — locked when no api key */}
        <CategoryChip
          label="NSFW"
          active={nsfw && hasApiKey}
          onClick={() => setNsfw((v) => !v)}
          icon={<IconNSFW />}
          variant="nsfw"
          disabled={!hasApiKey}
          title={hasApiKey ? "Toggle NSFW content" : "Requires a Wallhaven API key (Settings)"}
        />
      </div>

      {/* Search button */}
      <button
        type="submit"
        className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm rounded-lg px-4 py-1.5 transition-colors ml-auto"
      >
        Search
      </button>
    </form>
  );
}
