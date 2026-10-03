use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: Edit › Find runs the app's own ⌘F search (UX audit Oct 3, A: HIG menu bar).
pub struct EditFind;

impl MenuItemHandler for EditFind {
    const ID: &'static str = "anlg_edit_find";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Find", true, Some("CmdOrCtrl+F"))?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        super::menu_action(app, "find");
    }
}
