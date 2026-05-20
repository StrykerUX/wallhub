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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [seed] = useState(() => Math.random().toString(36).slice(2, 8));
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getApiKey().then((k) => setHasApiKey(!!k));
  }, []);

  const fetchPage = useCallback(
    async (p: SearchParams, pageNum: number, append = false) => {
      setLoading(true);
      try {
        const res = await api.search({
          ...p,
          page: pageNum,
          seed: p.sorting === "random" ? seed : undefined,
        });
        setWallpapers((prev) =>
          append ? [...prev, ...res.data] : res.data
        );
        setHasMore(pageNum < res.meta.last_page);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [seed]
  );

  // Initial load
  useEffect(() => {
    fetchPage(params, 1);
  }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          const next = page + 1;
          setPage(next);
          fetchPage(params, next, true);
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [loading, hasMore, page, params, fetchPage]);

  function handleSearch(newParams: SearchParams) {
    setParams(newParams);
    setPage(1);
    setHasMore(true);
    fetchPage(newParams, 1);
  }

  return (
    <div className="flex flex-col h-full">
      <FilterBar hasApiKey={hasApiKey} onSearch={handleSearch} />

      <div className="flex-1 overflow-y-auto p-4">
        {wallpapers.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
            No wallpapers found. Adjust filters and search.
          </div>
        )}

        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
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
