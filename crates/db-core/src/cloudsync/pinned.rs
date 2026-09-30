use std::sync::Arc;

use anlg_cloudsync::{OwnedSqliteConnection, ReservedConnection};
use sqlx::pool::PoolConnection;
use sqlx::{Sqlite, SqliteConnection, SqlitePool};
use tokio::sync::{Mutex, OwnedMutexGuard};

pub(crate) struct PinnedCloudsyncConnection(
    pub(crate) OwnedMutexGuard<Option<PoolConnection<Sqlite>>>,
);

impl OwnedSqliteConnection for PinnedCloudsyncConnection {
    fn sqlite_connection(&mut self) -> &mut SqliteConnection {
        self.0.as_mut().expect("pinned CloudSync connection")
    }
}

pub(crate) async fn reserve_pinned_connection(
    pool: &SqlitePool,
    slot: &Arc<Mutex<Option<PoolConnection<Sqlite>>>>,
) -> Result<ReservedConnection<PinnedCloudsyncConnection>, anlg_cloudsync::Error> {
    let mut pinned = Arc::clone(slot).lock_owned().await;
    if pinned.is_none() {
        *pinned = Some(pool.acquire().await?);
    }
    Ok(ReservedConnection::new(PinnedCloudsyncConnection(pinned)))
}

pub(crate) fn release_pinned_connection(
    pool: &SqlitePool,
    connection: ReservedConnection<PinnedCloudsyncConnection>,
) {
    let Some(mut pinned) = connection.into_inner() else {
        return;
    };
    if pool.options().get_max_connections() == 1 {
        pinned.0.take();
    }
}
