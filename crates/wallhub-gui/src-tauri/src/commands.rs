use serde::{Deserialize, Serialize};
use wallhub_core::{
    config::{Config, RotationConfig},
    ipc::{IpcClient, IpcStatus},
    storage::{LocalWallpaper, Storage},
    wallhaven::{SearchParams, SearchResponse, WallhavenClient},
    wallpaper::{set_wallpaper, WallpaperTarget},
};

fn api_key() -> Option<String> {
    keyring::Entry::new("wallhub", "wallhaven")
        .ok()
        .and_then(|e| e.get_password().ok())
}

// ─── Wallhaven search ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_wallpapers(params: SearchParams) -> Result<SearchResponse, String> {
    let client = WallhavenClient::new(api_key());
    client.search(&params).await.map_err(|e| e.to_string())
}

// ─── Wallpaper apply ─────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct SetWallpaperArgs {
    pub path: String,
    pub target: WallpaperTarget,
}

#[tauri::command]
pub fn set_wallpaper_cmd(args: SetWallpaperArgs) -> Result<(), String> {
    set_wallpaper(std::path::Path::new(&args.path), args.target).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct DownloadArgs {
    pub wallhaven_id: String,
    pub url: String,
    pub target: Option<WallpaperTarget>,
}

#[tauri::command]
pub async fn download_wallpaper(args: DownloadArgs) -> Result<String, String> {
    let cfg = Config::load().map_err(|e| e.to_string())?;
    let storage = Storage::new(cfg.general.wallpaper_dir).map_err(|e| e.to_string())?;
    let client = WallhavenClient::new(api_key());
    let path = storage
        .download_wallpaper(&client, &args.wallhaven_id, &args.url)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(target) = args.target {
        set_wallpaper(&path, target).map_err(|e| e.to_string())?;
    }
    Ok(path.to_string_lossy().into_owned())
}

// ─── API key (keyring) ───────────────────────────────────────────────────────

#[tauri::command]
pub fn save_api_key(key: String) -> Result<(), String> {
    keyring::Entry::new("wallhub", "wallhaven")
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key() -> Option<String> {
    api_key()
}

// ─── Daemon / scheduler IPC ──────────────────────────────────────────────────

#[tauri::command]
pub async fn get_scheduler_status() -> Result<IpcStatus, String> {
    IpcClient::status().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trigger_next() -> Result<IpcStatus, String> {
    IpcClient::next().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pause_daemon() -> Result<IpcStatus, String> {
    IpcClient::pause().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resume_daemon() -> Result<IpcStatus, String> {
    IpcClient::resume().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_daemon() -> Result<(), String> {
    let binary = dirs::data_local_dir()
        .unwrap_or_default()
        .join("../bin/wallhub-daemon");

    // Try to start via systemctl first
    let via_systemctl = std::process::Command::new("systemctl")
        .args(["--user", "start", "wallhub-daemon.service"])
        .status();

    if via_systemctl.map(|s| s.success()).unwrap_or(false) {
        return Ok(());
    }

    // Fallback: spawn directly (first run before service is installed)
    std::process::Command::new(&binary)
        .spawn()
        .map_err(|e| format!("failed to start daemon: {e}"))?;
    Ok(())
}

// ─── Rotation config ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn set_rotation_mode(rotation: RotationConfig) -> Result<(), String> {
    let mut cfg = Config::load().map_err(|e| e.to_string())?;
    cfg.rotation = rotation;
    cfg.save().map_err(|e| e.to_string())?;
    let _ = IpcClient::reload().await;
    Ok(())
}

// ─── Config ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_config() -> Result<Config, String> {
    Config::load().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config(config: Config) -> Result<(), String> {
    config.save().map_err(|e| e.to_string())?;
    let _ = IpcClient::reload().await;
    Ok(())
}

// ─── Library ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_library() -> Result<Vec<LocalWallpaper>, String> {
    let cfg = Config::load().map_err(|e| e.to_string())?;
    let storage = Storage::new(cfg.general.wallpaper_dir).map_err(|e| e.to_string())?;
    Ok(storage.list_local())
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct GeoResult {
    pub lat: f64,
    pub lon: f64,
    pub city: String,
}

#[tauri::command]
pub async fn detect_location() -> Result<GeoResult, String> {
    #[derive(Deserialize)]
    struct IpApiResponse {
        latitude: f64,
        longitude: f64,
        city: String,
    }
    let resp = reqwest::get("https://ipapi.co/json/")
        .await
        .map_err(|e| e.to_string())?
        .json::<IpApiResponse>()
        .await
        .map_err(|e| e.to_string())?;

    // Persist in config
    let mut cfg = Config::load().map_err(|e| e.to_string())?;
    cfg.location.lat = resp.latitude;
    cfg.location.lon = resp.longitude;
    cfg.save().map_err(|e| e.to_string())?;

    Ok(GeoResult {
        lat: resp.latitude,
        lon: resp.longitude,
        city: resp.city,
    })
}
