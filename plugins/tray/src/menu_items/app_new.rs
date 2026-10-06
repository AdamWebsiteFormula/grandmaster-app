use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

pub struct AppNew;

impl MenuItemHandler for AppNew {
    const ID: &'static str = "anlg_app_new";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        // Fork: "Record meeting" creates a note and starts recording; the label
        // says so (owner's pick, Oct 6; Apple HIG Buttons). The web side routes
        // /app/new with no search to record (UX audit Oct 3, A).
        let item = MenuItem::with_id(app, Self::ID, "Record meeting", true, Some("CmdOrCtrl+N"))?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        use tauri_plugin_windows::{AppWindow, Navigate, WindowsPluginExt};
        if app.windows().show(AppWindow::Main).is_ok() {
            let _ = app.windows().emit_navigate(
                AppWindow::Main,
                Navigate {
                    path: "/app/new".to_string(),
                    search: None,
                },
            );
        }
    }
}
