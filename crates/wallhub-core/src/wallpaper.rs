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

enum Desktop {
    Gnome,
    Kde,
}

fn detect_desktop() -> Desktop {
    let xdg = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_lowercase();
    if xdg.contains("kde") || xdg.contains("plasma") {
        Desktop::Kde
    } else {
        Desktop::Gnome
    }
}

pub fn set_wallpaper(path: &Path, target: WallpaperTarget) -> Result<()> {
    let jpeg_path = ensure_jpeg(path)?;
    match detect_desktop() {
        Desktop::Kde => set_wallpaper_kde(&jpeg_path, target),
        Desktop::Gnome => set_wallpaper_gnome(&jpeg_path, target),
    }
}

fn set_wallpaper_gnome(path: &Path, target: WallpaperTarget) -> Result<()> {
    let uri = path_to_file_uri(path);
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

fn set_wallpaper_kde(path: &Path, target: WallpaperTarget) -> Result<()> {
    let abs = absolute_path(path);
    if matches!(target, WallpaperTarget::Desktop | WallpaperTarget::Both) {
        let out = Command::new("plasma-apply-wallpaperimage")
            .arg(&abs)
            .output()
            .context("running plasma-apply-wallpaperimage — make sure plasma-workspace is installed")?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            anyhow::bail!("plasma-apply-wallpaperimage: {stderr}");
        }
    }
    if matches!(target, WallpaperTarget::LockScreen | WallpaperTarget::Both) {
        kde_set_lockscreen(&abs)?;
    }
    Ok(())
}

fn kde_set_lockscreen(abs_path: &Path) -> Result<()> {
    let uri = format!("file://{}", abs_path.display());
    // Write wallpaper path into kscreenlockerrc
    let out = Command::new("kwriteconfig6")
        .args([
            "--file", "kscreenlockerrc",
            "--group", "Greeter",
            "--group", "Wallpaper",
            "--group", "org.kde.image",
            "--group", "General",
            "--key", "Image",
            &uri,
        ])
        .output()
        .context("running kwriteconfig6")?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!("kwriteconfig6: {stderr}");
    }
    // Signal the screen locker to reload its config (best-effort)
    let _ = Command::new("qdbus6")
        .args(["org.kde.screensaver", "/ScreenSaver", "org.kde.screensaver.configure"])
        .output();
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

fn absolute_path(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default().join(path)
    }
}

fn path_to_file_uri(path: &Path) -> String {
    format!("file://{}", absolute_path(path).display())
}
