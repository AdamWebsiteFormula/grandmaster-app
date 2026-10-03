use super::DockMenuItem;

pub struct DockQuit;

// Fork: asks first, like the tray's Quit completely, even mid-recording (UX
// audit Oct 3, A: NN/g #5, HIG alerts).
impl DockMenuItem for DockQuit {
    fn title(app: &tauri::AppHandle<tauri::Wry>) -> String {
        format!("Quit {} completely…", app.package_info().name)
    }

    fn handle(app: &tauri::AppHandle<tauri::Wry>) {
        tauri_plugin_tray::AnlgMenuItem::TrayQuitCompletely.handle(app);
    }
}
