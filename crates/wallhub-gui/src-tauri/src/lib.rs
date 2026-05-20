mod commands;


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::search_wallpapers,
            commands::set_wallpaper_cmd,
            commands::download_wallpaper,
            commands::save_api_key,
            commands::get_api_key,
            commands::get_scheduler_status,
            commands::set_rotation_mode,
            commands::trigger_next,
            commands::pause_daemon,
            commands::resume_daemon,
            commands::get_library,
            commands::get_config,
            commands::save_config,
            commands::detect_location,
            commands::start_daemon,
        ])
        .setup(|_app| {
            // Ensure wallpaper directories exist
            if let Ok(cfg) = wallhub_core::config::Config::load() {
                let _ = wallhub_core::storage::Storage::new(cfg.general.wallpaper_dir);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
