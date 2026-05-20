use anyhow::{Context, Result};
use chrono::{Local, NaiveDate};
use rand::prelude::IndexedRandom;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::wallhaven::WallhavenClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WallpaperMeta {
    pub id: String,
    pub file_name: String,
    pub source_url: Option<String>,
    pub wallhaven_id: Option<String>,
    pub applied_at: Option<String>,
    pub resolution: Option<String>,
    pub tags: Vec<String>,
}

pub struct Storage {
    pub root: PathBuf,
}

impl Storage {
    pub fn new(root: PathBuf) -> Result<Self> {
        for sub in ["downloaded", "daily", "local"] {
            std::fs::create_dir_all(root.join(sub))
                .with_context(|| format!("creating {sub} dir"))?;
        }
        Ok(Self { root })
    }

    pub fn downloaded_dir(&self) -> PathBuf {
        self.root.join("downloaded")
    }

    pub fn daily_dir(&self) -> PathBuf {
        self.root.join("daily")
    }

    pub fn local_dir(&self) -> PathBuf {
        self.root.join("local")
    }

    /// Download a wallpaper from its full URL and save to downloaded/.
    /// Returns the saved path.
    pub async fn download_wallpaper(
        &self,
        client: &WallhavenClient,
        wallhaven_id: &str,
        url: &str,
    ) -> Result<PathBuf> {
        let ext = url.rsplit('.').next().unwrap_or("jpg");
        let filename = format!("{wallhaven_id}.{ext}");
        let dest = self.downloaded_dir().join(&filename);
        if dest.exists() {
            return Ok(dest);
        }
        let bytes = client.download_bytes(url).await?;
        std::fs::write(&dest, &bytes)
            .with_context(|| format!("writing wallpaper to {}", dest.display()))?;
        Ok(dest)
    }

    /// Download + save to daily/ for a specific date.
    pub async fn download_daily(
        &self,
        client: &WallhavenClient,
        _wallhaven_id: &str,
        url: &str,
        date: NaiveDate,
    ) -> Result<PathBuf> {
        let ext = url.rsplit('.').next().unwrap_or("jpg");
        let filename = format!("{}.{ext}", date.format("%Y-%m-%d"));
        let dest = self.daily_dir().join(&filename);
        if dest.exists() {
            return Ok(dest);
        }
        let bytes = client.download_bytes(url).await?;
        std::fs::write(&dest, &bytes)
            .with_context(|| format!("writing daily wallpaper to {}", dest.display()))?;
        Ok(dest)
    }

    /// Get today's daily wallpaper if it exists.
    pub fn get_today_daily(&self) -> Option<PathBuf> {
        let today = Local::now().date_naive();
        for ext in ["jpg", "jpeg", "png", "webp"] {
            let p = self.daily_dir().join(format!("{}.{ext}", today.format("%Y-%m-%d")));
            if p.exists() {
                return Some(p);
            }
        }
        None
    }

    /// Pick a random wallpaper from the local pool (downloaded + local dirs).
    pub fn get_random_local(&self) -> Option<PathBuf> {
        let mut files: Vec<PathBuf> = Vec::new();
        for dir in [self.downloaded_dir(), self.local_dir()] {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for e in entries.flatten() {
                    let p = e.path();
                    if is_image(&p) {
                        files.push(p);
                    }
                }
            }
        }
        files.choose(&mut rand::rng()).cloned()
    }

    /// List all wallpapers in downloaded/ and local/ with basic metadata.
    pub fn list_local(&self) -> Vec<LocalWallpaper> {
        let mut result = Vec::new();
        for (dir, source) in [
            (self.downloaded_dir(), "downloaded"),
            (self.local_dir(), "local"),
            (self.daily_dir(), "daily"),
        ] {
            if let Ok(entries) = std::fs::read_dir(&dir) {
                for e in entries.flatten() {
                    let path = e.path();
                    if is_image(&path) {
                        let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
                        result.push(LocalWallpaper {
                            path: path.to_string_lossy().into_owned(),
                            file_name: name,
                            source: source.to_string(),
                        });
                    }
                }
            }
        }
        result
    }

    pub fn add_local_file(&self, src: &Path) -> Result<PathBuf> {
        let filename = src.file_name().context("no filename")?;
        let dest = self.local_dir().join(filename);
        std::fs::copy(src, &dest)?;
        Ok(dest)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalWallpaper {
    pub path: String,
    pub file_name: String,
    pub source: String,
}

fn is_image(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "avif"
    )
}
