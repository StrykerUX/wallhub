use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use wallhub_core::{
    config::{Config, RotationConfig},
    ipc::{IpcClient, IpcStatus},
    storage::{LocalWallpaper, Storage},
    wallhaven::{SearchParams, SearchResponse, WallhavenClient},
    wallpaper::{set_wallpaper, WallpaperTarget},
};

use crate::RateLimiterState;

fn api_key() -> Option<String> {
    Config::load().ok().and_then(|c| c.api_key)
}

fn make_client(limiter: &RateLimiterState) -> WallhavenClient {
    WallhavenClient::with_limiter(api_key(), Arc::clone(&limiter.0))
}

// ─── Wallhaven search ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_wallpapers(
    params: SearchParams,
    limiter: State<'_, RateLimiterState>,
) -> Result<SearchResponse, String> {
    make_client(&limiter).search(&params).await.map_err(|e| e.to_string())
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
pub async fn download_wallpaper(
    args: DownloadArgs,
    limiter: State<'_, RateLimiterState>,
) -> Result<String, String> {
    let cfg = Config::load().map_err(|e| e.to_string())?;
    let storage = Storage::new(cfg.general.wallpaper_dir).map_err(|e| e.to_string())?;
    let client = make_client(&limiter);
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
    let mut cfg = Config::load().map_err(|e| e.to_string())?;
    cfg.api_key = if key.is_empty() { None } else { Some(key) };
    cfg.save().map_err(|e| e.to_string())
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

    // Try restart (covers both "start" and "already running but stale binary")
    let via_systemctl = std::process::Command::new("systemctl")
        .args(["--user", "restart", "wallhub-daemon.service"])
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
        #[serde(default)]
        latitude: f64,
        #[serde(default)]
        longitude: f64,
        #[serde(default)]
        city: String,
    }
    let raw = reqwest::get("https://ipapi.co/json/")
        .await
        .map_err(|e| format!("network error: {e}"))?
        .text()
        .await
        .map_err(|e| format!("read error: {e}"))?;

    let resp: IpApiResponse = serde_json::from_str(&raw)
        .map_err(|e| format!("ipapi.co parse error: {e}\nresponse: {raw}"))?;

    if resp.latitude == 0.0 && resp.longitude == 0.0 {
        return Err("ipapi.co returned no location (possibly rate-limited)".into());
    }

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
