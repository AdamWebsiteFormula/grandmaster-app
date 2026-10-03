use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

use super::MenuItemHandler;

pub struct TrayQuit;

impl MenuItemHandler for TrayQuit {
    const ID: &'static str = "anlg_tray_quit";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let title = format!("Quit {}", app.package_info().name);
        let item = MenuItem::with_id(app, Self::ID, title, true, Some("cmd+q"))?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        // Fork: while recording, Quit asks first, like Quit completely
        // (journey-meeting P2; Apple HIG Alerts; NN/g #5). The normal exit
        // still runs the frontend flush, so the recording is saved.
        if !crate::ext::is_recording() {
            app.exit(0);
            return;
        }

        let app_name = app.package_info().name.clone();
        let app = app.clone();
        app.dialog()
            .message("Your recording stops and is saved.")
            .title(format!("Quit {}?", app_name))
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Quit".to_string(),
                "Cancel".to_string(),
            ))
            .show(move |confirmed| {
                if confirmed {
                    app.exit(0);
                }
            });
    }
}
