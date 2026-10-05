use tauri::{
    AppHandle, Emitter, Result,
    menu::{MenuItem, MenuItemKind},
};

use super::MenuItemHandler;

// Fork: while recording, the menu bar extra offers Stop recording in place of
// the disabled Start recording (journey-meeting P3; Apple HIG, The menu bar: menu
// bar extras expose key actions). It sends the main window's existing stop
// request (stt/window-control.tsx); an empty session id means "the live one".
pub struct TrayStopRecording;

pub(crate) const LISTENER_CONTROL_EVENT: &str = "anlg:listener-control";

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ListenerControlRequest {
    pub action: &'static str,
    pub request_id: String,
    pub session_id: String,
}

pub(crate) fn stop_request() -> ListenerControlRequest {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    ListenerControlRequest {
        action: "stop",
        request_id: format!("tray-stop-{nanos}"),
        session_id: String::new(),
    }
}

impl MenuItemHandler for TrayStopRecording {
    const ID: &'static str = "anlg_tray_stop_recording";

    fn build(app: &AppHandle<tauri::Wry>) -> Result<MenuItemKind<tauri::Wry>> {
        let item = MenuItem::with_id(app, Self::ID, "Stop recording", true, None::<&str>)?;
        Ok(MenuItemKind::MenuItem(item))
    }

    fn handle(app: &AppHandle<tauri::Wry>) {
        if let Err(error) = app.emit_to("main", LISTENER_CONTROL_EVENT, stop_request()) {
            tracing::warn!(%error, "failed to request stop from the tray");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stop_request_matches_the_main_window_listener_shape() {
        let value = serde_json::to_value(stop_request()).unwrap();
        assert_eq!(value["action"], "stop");
        assert_eq!(value["sessionId"], "");
        assert!(
            value["requestId"]
                .as_str()
                .unwrap()
                .starts_with("tray-stop-")
        );
    }
}
