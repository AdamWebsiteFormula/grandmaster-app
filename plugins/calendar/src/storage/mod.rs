mod connection_sync;
mod identity;
mod ignored;
mod inventory;
mod participants;
mod selection;
mod transaction_utils;
mod vec_map;

pub use connection_sync::{
    SyncCalendarConnectionEventsRequest, sync_calendar_connection_events,
    tombstone_calendar_connection,
};
pub use ignored::{UpdateIgnoredCalendarItemRequest, update_ignored_calendar_item};
pub use inventory::{ApplyCalendarInventoryRequest, apply_calendar_inventory};
pub use selection::{SetCalendarEnabledRequest, set_calendar_enabled};

use anlg_calendar_interface::CalendarProviderType;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TombstoneCalendarConnectionRequest {
    pub provider: CalendarProviderType,
    pub connection_id: String,
}

fn provider_str(provider: CalendarProviderType) -> &'static str {
    match provider {
        CalendarProviderType::Apple => "apple",
        CalendarProviderType::Google => "google",
        CalendarProviderType::Outlook => "outlook",
    }
}
