use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

pub struct HelpReportBug;

impl MenuItemHandler for HelpReportBug {
    const ID: &'static str = "anlg_help_report_bug";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Report a bug…", true, None::<&str>)?;
        Ok(MenuItemKind::MenuItem(item))
    }

    // Fork: Issues are off on the repo, so point to the README Support section
    // (UX audit Oct 3, A: NN/g #10).
    fn handle(_app: &AppHandle<tauri::Wry>) {
        let _ = open::that(super::SUPPORT_URL);
    }
}
