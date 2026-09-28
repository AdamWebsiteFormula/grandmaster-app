use std::sync::Arc;
use std::sync::mpsc;
use std::thread::ThreadId;

use anlg_db_reactive::QueryEventSink;

#[uniffi::export(with_foreign)]
pub trait QueryEventListener: Send + Sync {
    fn on_result(&self, rows_json: String);
    fn on_error(&self, message: String);
}

enum QueryEvent {
    Result(String),
    Error(String),
}

struct Delivery {
    listener: Arc<dyn QueryEventListener>,
    event: QueryEvent,
}

impl Delivery {
    fn deliver(self) {
        match self.event {
            QueryEvent::Result(rows_json) => self.listener.on_result(rows_json),
            QueryEvent::Error(message) => self.listener.on_error(message),
        }
    }
}

/// Foreign listeners block their caller until the JS thread runs them, so
/// events raised off the subscribing thread are handed to a dedicated thread
/// instead of holding runtime workers and live-query state hostage to JS.
pub(crate) struct ListenerDelivery {
    sender: mpsc::Sender<Delivery>,
}

impl ListenerDelivery {
    pub(crate) fn spawn() -> std::io::Result<Self> {
        let (sender, receiver) = mpsc::channel::<Delivery>();
        std::thread::Builder::new()
            .name("mobile-bridge-live-query".to_string())
            .spawn(move || {
                for delivery in receiver {
                    delivery.deliver();
                }
            })?;
        Ok(Self { sender })
    }

    pub(crate) fn sink(&self, listener: Arc<dyn QueryEventListener>) -> ListenerSink {
        ListenerSink {
            listener,
            owner: std::thread::current().id(),
            sender: self.sender.clone(),
        }
    }
}

#[derive(Clone)]
pub(crate) struct ListenerSink {
    listener: Arc<dyn QueryEventListener>,
    owner: ThreadId,
    sender: mpsc::Sender<Delivery>,
}

impl ListenerSink {
    fn send(&self, event: QueryEvent) -> std::result::Result<(), String> {
        let delivery = Delivery {
            listener: Arc::clone(&self.listener),
            event,
        };
        if std::thread::current().id() == self.owner {
            delivery.deliver();
            return Ok(());
        }
        self.sender
            .send(delivery)
            .map_err(|_| "live query delivery stopped".to_string())
    }
}

impl QueryEventSink for ListenerSink {
    fn send_result(&self, rows: Vec<serde_json::Value>) -> std::result::Result<(), String> {
        let rows_json = serde_json::to_string(&rows).map_err(|error| error.to_string())?;
        self.send(QueryEvent::Result(rows_json))
    }

    fn send_error(&self, error: String) -> std::result::Result<(), String> {
        self.send(QueryEvent::Error(error))
    }
}
