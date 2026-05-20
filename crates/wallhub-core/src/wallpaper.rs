use anyhow::{Context, Result};
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WallpaperTarget {
    Desktop,
    LockScreen,
    Both,
}

pub fn set_wallpaper(path: &Path, target: WallpaperTarget) -> Result<()> {
    let jpeg_path = ensure_jpeg(path)?;
    let uri = path_to_file_uri(&jpeg_path);

    if matches!(target, WallpaperTarget::Desktop | WallpaperTarget::Both) {
        gsettings("org.gnome.desktop.background", "picture-uri", &uri)?;
        gsettings("org.gnome.desktop.background", "picture-uri-dark", &uri)?;
        gsettings("org.gnome.desktop.background", "picture-options", "zoom")?;
    }
    if matches!(target, WallpaperTarget::LockScreen | WallpaperTarget::Both) {
        gsettings("org.gnome.desktop.screensaver", "picture-uri", &uri)?;
        gsettings("org.gnome.desktop.screensaver", "picture-options", "zoom")?;
    }
    Ok(())
}

fn gsettings(schema: &str, key: &str, value: &str) -> Result<()> {
    let out = Command::new("gsettings")
        .args(["set", schema, key, value])
        .output()
        .with_context(|| format!("running gsettings set {schema} {key}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("gsettings error: {stderr}");
    }
    Ok(())
}

fn ensure_jpeg(path: &Path) -> Result<PathBuf> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // JPEG and PNG are natively supported — no conversion needed
    if matches!(ext.as_str(), "jpg" | "jpeg" | "png") {
        return Ok(path.to_path_buf());
    }

    // WebP, AVIF, and others → convert to JPEG alongside original
    let jpeg_path = path.with_extension("jpg");
    if jpeg_path.exists() {
        return Ok(jpeg_path);
    }
    let img = image::open(path)
        .with_context(|| format!("opening image {}", path.display()))?;
    img.save_with_format(&jpeg_path, ImageFormat::Jpeg)
        .with_context(|| format!("saving JPEG to {}", jpeg_path.display()))?;
    Ok(jpeg_path)
}

fn path_to_file_uri(path: &Path) -> String {
    let abs = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .unwrap_or_default()
            .join(path)
    };
    format!("file://{}", abs.display())
}
