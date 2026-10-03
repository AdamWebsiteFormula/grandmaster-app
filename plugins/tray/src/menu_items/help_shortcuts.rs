use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: Help › Keyboard shortcuts opens the shortcut list (UX audit Oct 3, A: NN/g #6, #10; HIG keyboards).
pub struct HelpKeyboardShortcuts;

impl MenuItemHandler for HelpKeyboardShortcuts {
    const ID: &'static str = "anlg_help_shortcuts";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(
            app,
            Self::ID,
            "Keyboard shortcuts",
            true,
            Some("CmdOrCtrl+/"),
        )?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        super::menu_action(app, "shortcuts");
    }
}
