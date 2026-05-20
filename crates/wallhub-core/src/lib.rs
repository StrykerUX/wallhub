pub mod config;
pub mod ipc;
pub mod scheduler;
pub mod storage;
pub mod wallhaven;
pub mod wallpaper;

pub use config::Config;
pub use wallhaven::WallhavenClient;
pub use wallpaper::set_wallpaper;
