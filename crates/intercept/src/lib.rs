use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
use swift_rs::swift;

#[cfg(target_os = "macos")]
swift!(fn _setup_force_quit_handler());

#[cfg(target_os = "macos")]
swift!(fn _show_quit_overlay());

#[cfg(target_os = "macos")]
swift!(fn _demo_quit_progress());

#[cfg(target_os = "macos")]
static HANDLER_INITIALIZED: AtomicBool = AtomicBool::new(false);

static FORCE_QUIT: AtomicBool = AtomicBool::new(false);

// Fork: the second ⌘Q quits through the app (app.exit), so the frontend
// flush of the last typed notes still runs; it no longer force-quits
// (journey-meeting P2; Apple HIG Alerts; NN/g #5).
type QuitHandler = Box<dyn Fn() + Send + Sync>;
static QUIT_HANDLER: OnceLock<QuitHandler> = OnceLock::new();

pub fn set_quit_handler(handler: impl Fn() + Send + Sync + 'static) {
    let _ = QUIT_HANDLER.set(Box::new(handler));
}

/// Runs the app's quit handler. Returns false when none is set, so the
/// caller can fall back to terminating directly.
pub fn request_quit() -> bool {
    match QUIT_HANDLER.get() {
        Some(handler) => {
            handler();
            true
        }
        None => false,
    }
}

#[cfg(target_os = "macos")]
pub fn setup_force_quit_handler() {
    if !HANDLER_INITIALIZED.swap(true, Ordering::SeqCst) {
        unsafe {
            _setup_force_quit_handler();
        }
    }
}

pub fn should_force_quit() -> bool {
    FORCE_QUIT.load(Ordering::SeqCst)
}

pub fn set_force_quit() {
    FORCE_QUIT.store(true, Ordering::SeqCst);
}

#[cfg(target_os = "macos")]
pub fn show_quit_overlay() {
    unsafe {
        _show_quit_overlay();
    }
}

#[cfg(target_os = "macos")]
pub fn demo_quit_progress() {
    unsafe {
        _demo_quit_progress();
    }
}

#[unsafe(no_mangle)]
#[cfg(target_os = "macos")]
pub extern "C" fn rust_set_force_quit() {
    set_force_quit();
}

#[unsafe(no_mangle)]
#[cfg(target_os = "macos")]
pub extern "C" fn rust_request_quit() -> bool {
    request_quit()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_quit_runs_the_app_handler_once_set() {
        use std::sync::atomic::AtomicUsize;
        static CALLS: AtomicUsize = AtomicUsize::new(0);

        assert!(!request_quit());
        set_quit_handler(|| {
            CALLS.fetch_add(1, Ordering::SeqCst);
        });
        assert!(request_quit());
        assert_eq!(CALLS.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn set_force_quit_skips_later_flush_check() {
        assert!(!should_force_quit());
        set_force_quit();
        assert!(should_force_quit());
    }
}
