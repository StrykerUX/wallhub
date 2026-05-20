"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import FilterBar from "@/components/FilterBar";
import WallpaperCard from "@/components/WallpaperCard";
import { api, type SearchParams, type Wallpaper } from "@/lib/tauri";

export default function BrowsePage() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [params, setParams] = useState<SearchParams>({
    sorting: "date_added",
    atleast: "1920x1080",
    ratios: "16x9",
    categories: "100",
    purity: "100",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [seed] = useState(() => Math.random().toString(36).slice(2, 8));

  const loaderRef = useRef<HTMLDivElement>(null);
  // Refs so the IntersectionObserver closure never goes stale
  const fetchingRef = useRef(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    api.getConfig().then((cfg) => setHasApiKey(!!cfg.api_key));
  }, []);

  const fetchPage = useCallback(
    async (p: SearchParams, pageNum: number, append = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const res = await api.search({
          ...p,
          page: pageNum,
          seed: p.sorting === "random" ? seed : undefined,
        });
        setWallpapers((prev) => (append ? [...prev, ...res.data] : res.data));
        pageRef.current = pageNum;
        hasMoreRef.current = pageNum < res.meta.last_page;
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [seed]
  );

  // Initial load
  useEffect(() => {
    fetchPage(paramsRef.current, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll — created once, reads state via refs
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetchingRef.current && hasMoreRef.current) {
          fetchPage(paramsRef.current, pageRef.current + 1, true);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchPage]);

  function handleSearch(newParams: SearchParams) {
    pageRef.current = 1;
    hasMoreRef.current = true;
    setParams(newParams);
    fetchPage(newParams, 1);
  }

  return (
    <div className="flex flex-col h-full">
      <FilterBar hasApiKey={hasApiKey} onSearch={handleSearch} />

      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-red-400 text-sm">Failed to load wallpapers</p>
            <p className="text-[var(--muted)] text-xs max-w-sm text-center">{error}</p>
            <button
              onClick={() => fetchPage(paramsRef.current, 1)}
              className="mt-1 text-xs bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text)] rounded-lg px-3 py-1.5 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {wallpapers.length === 0 && !loading && !error && (
          <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
            No wallpapers found. Adjust filters and search.
          </div>
        )}

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {wallpapers.map((w) => (
            <WallpaperCard key={w.id} wallpaper={w} />
          ))}
        </div>

        <div ref={loaderRef} className="h-8 flex items-center justify-center mt-4">
          {loading && (
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
}
