use super::DockMenuItem;

pub struct DockRestart;

// Fork: asks first, like Quit completely (UX audit Oct 3, A: NN/g #5).
impl DockMenuItem for DockRestart {
    fn title(app: &tauri::AppHandle<tauri::Wry>) -> String {
        format!("Restart {}…", app.package_info().name)
    }

    fn handle(app: &tauri::AppHandle<tauri::Wry>) {
        tauri_plugin_tray::confirm_restart(app);
    }
}
