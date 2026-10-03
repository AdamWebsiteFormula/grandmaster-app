use tauri::{
    AppHandle, Result,
    menu::{AboutMetadata, MenuItemKind, PredefinedMenuItem},
};

use super::MenuItemHandler;

pub struct AppInfo;

impl MenuItemHandler for AppInfo {
    const ID: &'static str = "anlg_app_info";

    // Fork: the standard macOS About panel instead of a debug dialog with the
    // commit SHA (UX audit Oct 3, A: HIG App menu).
    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let title = format!("About {}", app.package_info().name);
        let metadata = AboutMetadata {
            version: Some(app.package_info().version.to_string()),
            copyright: Some("Built on Anarlog (MIT)".to_string()),
            ..Default::default()
        };
        let item = PredefinedMenuItem::about(app, Some(&title), Some(metadata))?;
        Ok(MenuItemKind::Predefined(item))
    }

    // The predefined About item opens the system panel itself.
    fn handle(_app: &AppHandle<tauri::Wry>) {}
}
