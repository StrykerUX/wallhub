use anyhow::Result;
use chrono::{DateTime, Datelike, Local, Timelike};
use std::sync::{Arc, Mutex};
use tokio::sync::Notify;
use tokio::time::{interval, Duration};

use crate::config::{Config, RotationMode};
use crate::ipc::IpcStatus;
use crate::storage::Storage;
use crate::wallhaven::{SearchParams, WallhavenClient};
use crate::wallpaper::{set_wallpaper, WallpaperTarget};

pub struct Scheduler {
    config: Arc<Mutex<Config>>,
    paused: Arc<Mutex<bool>>,
    reload_notify: Arc<Notify>,
    next_at: Arc<Mutex<Option<DateTime<Local>>>>,
}

impl Scheduler {
    pub fn new(config: Config) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            paused: Arc::new(Mutex::new(false)),
            reload_notify: Arc::new(Notify::new()),
            next_at: Arc::new(Mutex::new(None)),
        }
    }

    pub fn reload_config(&self, new_cfg: Config) {
        *self.config.lock().unwrap() = new_cfg;
        self.reload_notify.notify_waiters();
    }

    pub fn pause(&self) {
        *self.paused.lock().unwrap() = true;
    }

    pub fn resume(&self) {
        *self.paused.lock().unwrap() = false;
    }

    pub fn is_paused(&self) -> bool {
        *self.paused.lock().unwrap()
    }

    pub fn next_at(&self) -> Option<DateTime<Local>> {
        *self.next_at.lock().unwrap()
    }

    pub fn status(&self) -> IpcStatus {
        let cfg = self.config.lock().unwrap();
        let mode = format!("{:?}", cfg.rotation.mode).to_lowercase();
        let next_at = self
            .next_at()
            .map(|t| t.to_rfc3339());
        IpcStatus {
            ok: true,
            state: if self.is_paused() { "paused" } else { "active" }.into(),
            mode,
            next_at,
            error: None,
        }
    }

    /// Apply next wallpaper immediately (skips schedule).
    pub async fn apply_next(&self) -> Result<()> {
        let cfg = self.config.lock().unwrap().clone();
        apply_for_config(&cfg).await
    }

    /// Main scheduling loop — runs forever.
    pub async fn run(&self) {
        loop {
            let cfg = self.config.lock().unwrap().clone();

            if self.is_paused() || cfg.rotation.mode == RotationMode::Disabled {
                // Just wait for a reload signal
                self.reload_notify.notified().await;
                continue;
            }

            match cfg.rotation.mode {
                RotationMode::Interval => {
                    let mins = cfg.rotation.interval_minutes;
                    let mut ticker = interval(Duration::from_secs(mins * 60));
                    ticker.tick().await; // first tick fires immediately — skip it
                    loop {
                        // Update next_at
                        let next = Local::now() + chrono::Duration::minutes(mins as i64);
                        *self.next_at.lock().unwrap() = Some(next);

                        tokio::select! {
                            _ = ticker.tick() => {
                                if !self.is_paused() {
                                    if let Err(e) = apply_for_config(&cfg).await {
                                        tracing::error!("rotation error: {e}");
                                    }
                                }
                            }
                            _ = self.reload_notify.notified() => break,
                        }
                    }
                }
                RotationMode::TimeOfDay => {
                    // Check every 30 min
                    let mut ticker = interval(Duration::from_secs(30 * 60));
                    loop {
                        tokio::select! {
                            _ = ticker.tick() => {
                                if !self.is_paused() {
                                    if let Err(e) = apply_time_of_day(&cfg).await {
                                        tracing::error!("time-of-day error: {e}");
                                    }
                                }
                            }
                            _ = self.reload_notify.notified() => break,
                        }
                    }
                }
                RotationMode::Daily => {
                    // Run at 6am, then wait until next 6am
                    loop {
                        let now = Local::now();
                        let next_6am = next_six_am(now);
                        let wait = (next_6am - now).to_std().unwrap_or(Duration::from_secs(60));
                        *self.next_at.lock().unwrap() = Some(next_6am);

                        tokio::select! {
                            _ = tokio::time::sleep(wait) => {
                                if !self.is_paused() {
                                    if let Err(e) = apply_daily(&cfg).await {
                                        tracing::error!("daily error: {e}");
                                    }
                                }
                            }
                            _ = self.reload_notify.notified() => break,
                        }
                    }
                }
                RotationMode::Disabled => {}
            }
        }
    }
}

async fn apply_for_config(cfg: &Config) -> Result<()> {
    let target = if cfg.general.apply_to_lock_screen {
        WallpaperTarget::Both
    } else {
        WallpaperTarget::Desktop
    };

    // Try to get a random local wallpaper
    let storage = Storage::new(cfg.general.wallpaper_dir.clone())?;
    if let Some(path) = storage.get_random_local() {
        return set_wallpaper(&path, target);
    }

    // Fallback: fetch a random one from wallhaven
    let api_key = get_api_key();
    let client = WallhavenClient::new(api_key);
    let params = SearchParams {
        sorting: Some("random".into()),
        atleast: cfg.rotation.atleast.clone(),
        ratios: cfg.rotation.ratios.clone(),
        categories: cfg.rotation.categories.clone(),
        purity: cfg.rotation.purity.clone(),
        ..Default::default()
    };
    let results = client.random(&params).await?;
    if let Some(wp) = results.data.first() {
        let path = storage.download_wallpaper(&client, &wp.id, &wp.path).await?;
        set_wallpaper(&path, target)?;
    }
    Ok(())
}

async fn apply_time_of_day(cfg: &Config) -> Result<()> {
    let target = if cfg.general.apply_to_lock_screen {
        WallpaperTarget::Both
    } else {
        WallpaperTarget::Desktop
    };

    // Simple hour-based detection:
    // dawn: 5–8, day: 8–18, dusk: 18–21, night: 21–5
    // For location-aware sunrise/sunset, users can adjust via UI in future.
    let hour = Local::now().hour();
    let wall = match hour {
        5..=7 => &cfg.time_of_day.dawn,
        8..=17 => &cfg.time_of_day.day,
        18..=20 => &cfg.time_of_day.dusk,
        _ => &cfg.time_of_day.night,
    };

    if let Some(path) = wall {
        set_wallpaper(path, target)?;
    }
    Ok(())
}

async fn apply_daily(cfg: &Config) -> Result<()> {
    let target = if cfg.general.apply_to_lock_screen {
        WallpaperTarget::Both
    } else {
        WallpaperTarget::Desktop
    };
    let storage = Storage::new(cfg.general.wallpaper_dir.clone())?;

    // Reuse today's if already downloaded
    if let Some(path) = storage.get_today_daily() {
        return set_wallpaper(&path, target);
    }

    let api_key = get_api_key();
    let client = WallhavenClient::new(api_key);
    let params = SearchParams {
        sorting: Some("random".into()),
        atleast: cfg.rotation.atleast.clone(),
        ratios: cfg.rotation.ratios.clone(),
        categories: cfg.rotation.categories.clone(),
        purity: cfg.rotation.purity.clone(),
        ..Default::default()
    };
    let results = client.random(&params).await?;
    if let Some(wp) = results.data.first() {
        let today = Local::now().date_naive();
        let path = storage.download_daily(&client, &wp.id, &wp.path, today).await?;
        set_wallpaper(&path, target)?;
    }
    Ok(())
}

fn get_api_key() -> Option<String> {
    crate::config::Config::load().ok().and_then(|c| c.api_key)
}

fn next_six_am(now: DateTime<Local>) -> DateTime<Local> {
    use chrono::TimeZone;
    let today_6am = Local
        .with_ymd_and_hms(now.year(), now.month(), now.day(), 6, 0, 0)
        .unwrap();
    if now < today_6am {
        today_6am
    } else {
        today_6am + chrono::Duration::days(1)
    }
}
