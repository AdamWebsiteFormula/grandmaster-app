use super::DockMenuItem;

pub struct DockNewNote;

impl DockMenuItem for DockNewNote {
    fn title(_app: &tauri::AppHandle<tauri::Wry>) -> String {
        // Fork: the same words as the Home button and File menu (Oct 6).
        "Record meeting".to_string()
    }

    fn handle(app: &tauri::AppHandle<tauri::Wry>) {
        tauri_plugin_tray::AnlgMenuItem::AppNew.handle(app);
    }
}
