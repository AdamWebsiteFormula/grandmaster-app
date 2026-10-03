use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: View › Show or hide sidebar runs the app's own ⌘\ toggle (UX audit Oct 3, A: HIG menu bar).
pub struct ViewSidebar;

impl MenuItemHandler for ViewSidebar {
    const ID: &'static str = "anlg_view_sidebar";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        // Fork: ⌘\ toggles, so the label says both, as the shortcuts dialog does.
        let item = MenuItem::with_id(
            app,
            Self::ID,
            "Show or hide sidebar",
            true,
            Some("CmdOrCtrl+\\"),
        )?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        super::menu_action(app, "toggle-sidebar");
    }
}
