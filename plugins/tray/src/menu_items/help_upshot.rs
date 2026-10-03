use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: "Upshot Help" opens the README (UX audit Oct 3, A: NN/g #10).
pub struct HelpAppHelp;

impl MenuItemHandler for HelpAppHelp {
    const ID: &'static str = "anlg_help_app_help";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let title = format!("{} Help", app.package_info().name);
        let item = MenuItem::with_id(app, Self::ID, title, true, None::<&str>)?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(_app: &AppHandle<tauri::Wry>) {
        let _ = open::that(super::HELP_URL);
    }
}
