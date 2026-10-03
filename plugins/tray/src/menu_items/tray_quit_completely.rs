use tauri::{
    AppHandle, Result,
    menu::{MenuItem, MenuItemKind},
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};

use super::MenuItemHandler;

pub struct TrayQuitCompletely;

impl MenuItemHandler for TrayQuitCompletely {
    const ID: &'static str = "anlg_tray_quit_completely";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Quit completely…", true, None::<&str>)?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        let app_name = app.package_info().name.clone();
        let app = app.clone();

        app.dialog()
            .message(format!(
                "{} will stop running in the background. A recording in progress stops.",
                app_name
            ))
            .title(format!("Quit {} completely?", app_name))
            .buttons(MessageDialogButtons::OkCancelCustom(
                "Quit completely".to_string(),
                "Cancel".to_string(),
            ))
            .show(move |confirmed| {
                if confirmed {
                    quit_completely(&app);
                }
            });
    }
}

// Fork: the Dock's Restart asks first, like Quit completely (UX audit Oct 3,
// A: NN/g #5, HIG alerts).
pub fn confirm_restart(app: &AppHandle<tauri::Wry>) {
    let app_name = app.package_info().name.clone();
    let app = app.clone();

    app.dialog()
        .message(format!(
            "{} will close and open again. A recording in progress stops.",
            app_name
        ))
        .title(format!("Restart {}?", app_name))
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Restart".to_string(),
            "Cancel".to_string(),
        ))
        .show(move |confirmed| {
            if confirmed {
                app.restart();
            }
        });
}

pub fn quit_completely(app: &AppHandle<tauri::Wry>) {
    // Skip the frontend exit flush so the process terminates immediately.
    anlg_intercept::set_force_quit();
    app.exit(0);
}
