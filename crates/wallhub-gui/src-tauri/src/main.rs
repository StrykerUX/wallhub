// Prevents an additional console window on Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    wallhub_gui_lib::run()
}
