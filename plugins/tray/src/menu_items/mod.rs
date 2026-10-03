mod app_blank_note;
mod app_info;
mod app_new;
mod edit_find;
mod help_report_bug;
mod help_shortcuts;
mod help_suggest_feature;
mod help_upshot;
mod tray_agenda;
mod tray_check_update;
mod tray_hide;
mod tray_open;
mod tray_quit;
mod tray_quit_completely;
mod tray_settings;
mod tray_show_events;
mod tray_start;
mod tray_stop_recording;
mod tray_version;
mod view_sidebar;

pub use app_blank_note::AppBlankNote;
pub use app_info::AppInfo;
pub use app_new::AppNew;
pub use edit_find::EditFind;
pub use help_report_bug::HelpReportBug;
pub use help_shortcuts::HelpKeyboardShortcuts;
pub use help_suggest_feature::HelpSuggestFeature;
pub use help_upshot::HelpAppHelp;
pub use tray_agenda::{build_agenda_item, handle_agenda_menu_event};
pub use tray_check_update::{TrayCheckUpdate, UpdateMenuState};
pub use tray_hide::TrayHide;
pub use tray_open::TrayOpen;
pub use tray_quit::TrayQuit;
pub use tray_quit_completely::{TrayQuitCompletely, confirm_restart, quit_completely};
pub use tray_settings::TraySettings;
pub use tray_show_events::TrayShowEvents;
pub use tray_start::TrayStart;
pub use tray_stop_recording::TrayStopRecording;
pub use tray_version::TrayVersion;
pub use view_sidebar::ViewSidebar;

use tauri::{AppHandle, Result, menu::MenuItemKind};

// Fork: Help links. The repo has Issues off, so bugs and ideas go to the
// README Support section (UX audit Oct 3, A: NN/g #10).
pub(crate) const SUPPORT_URL: &str =
    "https://github.com/AdamWebsiteFormula/grandmaster-app#support";
pub(crate) const HELP_URL: &str = "https://github.com/AdamWebsiteFormula/grandmaster-app#readme";

pub(crate) fn navigate_main(
    app: &AppHandle<tauri::Wry>,
    path: &str,
    search: Option<serde_json::Map<String, serde_json::Value>>,
) {
    use tauri_plugin_windows::{AppWindow, Navigate, WindowsPluginExt};
    if app.windows().show(AppWindow::Main).is_ok() {
        let _ = app.windows().emit_navigate(
            AppWindow::Main,
            Navigate {
                path: path.to_string(),
                search,
            },
        );
    }
}

// Menu items whose work lives in the web app (Find, sidebar, shortcut list)
// send "/app/menu?action=…"; shared/main-app-layout.tsx runs them.
pub(crate) fn menu_action(app: &AppHandle<tauri::Wry>, action: &str) {
    let mut search = serde_json::Map::new();
    search.insert(
        "action".to_string(),
        serde_json::Value::String(action.to_string()),
    );
    navigate_main(app, "/app/menu", Some(search));
}

pub trait MenuItemHandler {
    const ID: &'static str;

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>>;
    fn handle(app: &AppHandle<tauri::Wry>);
}

macro_rules! menu_items {
    ($($variant:ident => $item:ty),* $(,)?) => {
        #[derive(Debug, Clone, Copy)]
        pub enum AnlgMenuItem {
            $($variant),*
        }

        impl From<AnlgMenuItem> for tauri::menu::MenuId {
            fn from(value: AnlgMenuItem) -> Self {
                match value {
                    $(AnlgMenuItem::$variant => <$item as MenuItemHandler>::ID),*
                }.into()
            }
        }

        impl TryFrom<tauri::menu::MenuId> for AnlgMenuItem {
            type Error = ();

            fn try_from(id: tauri::menu::MenuId) -> std::result::Result<Self, Self::Error> {
                let id = id.0.as_str();
                match id {
                    $(<$item as MenuItemHandler>::ID => Ok(AnlgMenuItem::$variant),)*
                    _ => Err(()),
                }
            }
        }

        impl AnlgMenuItem {
            pub fn handle(self, app: &AppHandle<tauri::Wry>) {
                match self {
                    $(AnlgMenuItem::$variant => <$item>::handle(app)),*
                }
            }
        }
    };
}

menu_items! {
    TrayOpen => TrayOpen,
    TrayStart => TrayStart,
    TrayStopRecording => TrayStopRecording,
    TraySettings => TraySettings,
    TrayShowEvents => TrayShowEvents,
    TrayCheckUpdate => TrayCheckUpdate,
    TrayHide => TrayHide,
    TrayQuit => TrayQuit,
    TrayQuitCompletely => TrayQuitCompletely,
    TrayVersion => TrayVersion,
    AppInfo => AppInfo,
    AppNew => AppNew,
    AppBlankNote => AppBlankNote,
    EditFind => EditFind,
    ViewSidebar => ViewSidebar,
    HelpKeyboardShortcuts => HelpKeyboardShortcuts,
    HelpAppHelp => HelpAppHelp,
    HelpReportBug => HelpReportBug,
    HelpSuggestFeature => HelpSuggestFeature,
}
