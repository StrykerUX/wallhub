import { invoke } from "@tauri-apps/api/core";

export type WallpaperTarget = "desktop" | "lock_screen" | "both";

export interface Thumbs {
  large: string;
  original: string;
  small: string;
}

export interface Wallpaper {
  id: string;
  url: string;
  path: string;
  thumbs: Thumbs;
  resolution: string;
  ratio: string;
  purity: string;
  category: string;
  file_type: string;
  file_size: number;
  views: number;
  favorites: number;
  created_at: string;
  colors: string[];
}

export interface Meta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  seed?: string;
}

export interface SearchResponse {
  data: Wallpaper[];
  meta: Meta;
}

export interface SearchParams {
  q?: string;
  categories?: string;
  purity?: string;
  sorting?: string;
  atleast?: string;
  ratios?: string;
  page?: number;
  seed?: string;
}

export interface LocalWallpaper {
  path: string;
  file_name: string;
  source: string;
}

export interface IpcStatus {
  ok: boolean;
  state: "active" | "paused";
  mode: string;
  next_at?: string;
  error?: string;
}

export interface RotationConfig {
  mode: "disabled" | "time_of_day" | "interval" | "daily";
  interval_minutes: number;
  pool: "local" | "wallhaven" | "selection";
  selected_paths: string[];
  atleast?: string;
  ratios?: string;
  categories?: string;
  purity?: string;
}

export interface TimeOfDayConfig {
  dawn?: string;
  day?: string;
  dusk?: string;
  night?: string;
}

export interface Config {
  general: {
    wallpaper_dir: string;
    apply_to_lock_screen: boolean;
    convert_to_jpeg: boolean;
  };
  rotation: RotationConfig;
  time_of_day: TimeOfDayConfig;
  location: {
    lat: number;
    lon: number;
  };
  api_key?: string;
}

export const api = {
  search: (params: SearchParams) =>
    invoke<SearchResponse>("search_wallpapers", { params }),

  setWallpaper: (path: string, target: WallpaperTarget) =>
    invoke<void>("set_wallpaper_cmd", { args: { path, target } }),

  download: (wallhavenId: string, url: string, target?: WallpaperTarget) =>
    invoke<string>("download_wallpaper", {
      args: { wallhaven_id: wallhavenId, url, target },
    }),

  saveApiKey: (key: string) => invoke<void>("save_api_key", { key }),
  getApiKey: () => invoke<string | null>("get_api_key"),

  getStatus: () => invoke<IpcStatus>("get_scheduler_status"),
  triggerNext: () => invoke<IpcStatus>("trigger_next"),
  pauseDaemon: () => invoke<IpcStatus>("pause_daemon"),
  resumeDaemon: () => invoke<IpcStatus>("resume_daemon"),
  startDaemon: () => invoke<void>("start_daemon"),

  setRotationMode: (rotation: RotationConfig) =>
    invoke<void>("set_rotation_mode", { rotation }),

  getConfig: () => invoke<Config>("get_config"),
  saveConfig: (config: Config) => invoke<void>("save_config", { config }),

  getLibrary: () => invoke<LocalWallpaper[]>("get_library"),
  deleteWallpaper: (path: string) => invoke<void>("delete_wallpaper", { path }),

  detectLocation: () =>
    invoke<{ lat: number; lon: number; city: string }>("detect_location"),
};
