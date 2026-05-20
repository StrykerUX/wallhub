use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub general: GeneralConfig,
    pub rotation: RotationConfig,
    pub time_of_day: TimeOfDayConfig,
    pub location: LocationConfig,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralConfig {
    pub wallpaper_dir: PathBuf,
    pub apply_to_lock_screen: bool,
    pub convert_to_jpeg: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RotationMode {
    Disabled,
    TimeOfDay,
    Interval,
    Daily,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationConfig {
    pub mode: RotationMode,
    pub interval_minutes: u64,
    #[serde(default = "default_pool")]
    pub pool: String,
    /// Specific files to cycle through when pool == "selection"
    #[serde(default)]
    pub selected_paths: Vec<PathBuf>,
    // wallhaven search filters used in Interval/Daily/wallhaven-pool modes
    pub categories: Option<String>,
    pub purity: Option<String>,
    pub atleast: Option<String>,
    pub ratios: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimeOfDayConfig {
    pub dawn: Option<PathBuf>,
    pub day: Option<PathBuf>,
    pub dusk: Option<PathBuf>,
    pub night: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationConfig {
    pub lat: f64,
    pub lon: f64,
}

fn default_pool() -> String {
    "local".to_string()
}

impl Default for Config {
    fn default() -> Self {
        let wallpaper_dir = dirs::picture_dir()
            .unwrap_or_else(|| PathBuf::from("~/Pictures"))
            .join("Wallpapers");
        Self {
            general: GeneralConfig {
                wallpaper_dir,
                apply_to_lock_screen: true,
                convert_to_jpeg: true,
            },
            rotation: RotationConfig {
                mode: RotationMode::Disabled,
                interval_minutes: 60,
                pool: "local".into(),
                selected_paths: Vec::new(),
                categories: None,
                purity: None,
                atleast: Some("1920x1080".into()),
                ratios: Some("16x9".into()),
            },
            time_of_day: TimeOfDayConfig::default(),
            location: LocationConfig {
                lat: 19.4326,
                lon: -99.1332,
            },
            api_key: None,
        }
    }
}

impl Config {
    pub fn config_path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("~/.config"))
            .join("wallhub")
            .join("config.toml")
    }

    pub fn load() -> Result<Self> {
        let path = Self::config_path();
        if !path.exists() {
            let cfg = Self::default();
            cfg.save()?;
            return Ok(cfg);
        }
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("reading config from {}", path.display()))?;
        toml::from_str(&content).with_context(|| "parsing config.toml")
    }

    pub fn save(&self) -> Result<()> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
