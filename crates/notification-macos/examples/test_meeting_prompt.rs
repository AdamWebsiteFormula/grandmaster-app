mod common;

use notification_macos::*;

use std::ops::Add;
use std::time::Duration;

fn main() {
    common::run_app(|| {
        std::thread::sleep(Duration::from_millis(200));
        let timeout = Duration::from_secs(8);

        setup_expanded_accept_handler(|id, _tag| {
            println!("take_notes: {}", id);
        });
        setup_dismiss_handler(|id, _tag| {
            println!("not_now: {}", id);
        });

        let notification = Notification::builder()
            .key("mic-detected:prompt")
            .title("Weekly product sync")
            .message("")
            .timeout(timeout)
            .source(NotificationSource::MicDetected {
                app_names: vec!["Google Chrome".to_string()],
                app_ids: vec!["com.google.Chrome".to_string()],
                event_ids: vec![],
            })
            .action_label("Take notes")
            .presentation(NotificationPresentation::Prompt)
            .build();

        show(&notification);
        std::thread::sleep(timeout.add(Duration::from_secs(1)));
        std::process::exit(0);
    });
}
