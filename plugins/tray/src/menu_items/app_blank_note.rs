use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: "Blank note" (⇧⌘N) makes a note without recording; "New note" (⌘N)
// records (UX audit Oct 3, A: NN/g #4, Granola 101).
pub struct AppBlankNote;

impl MenuItemHandler for AppBlankNote {
    const ID: &'static str = "anlg_app_blank_note";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Blank note", true, Some("CmdOrCtrl+Shift+N"))?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        let mut search = serde_json::Map::new();
        search.insert(
            "record".to_string(),
            serde_json::Value::String("false".to_string()),
        );
        super::navigate_main(app, "/app/new", Some(search));
    }
}
