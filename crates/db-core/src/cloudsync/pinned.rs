use std::sync::Arc;

use anlg_cloudsync::{OwnedSqliteConnection, ReservedConnection};
use sqlx::pool::PoolConnection;
use sqlx::{Sqlite, SqliteConnection, SqlitePool};
use tokio::sync::{Mutex, OwnedMutexGuard};

pub(crate) struct PinnedCloudsyncConnection {
    guard: OwnedMutexGuard<Option<PoolConnection<Sqlite>>>,
    release_on_drop: bool,
}

impl PinnedCloudsyncConnection {
    pub(crate) fn new(
        guard: OwnedMutexGuard<Option<PoolConnection<Sqlite>>>,
        pool: &SqlitePool,
    ) -> Self {
        Self {
            guard,
            release_on_drop: pool.options().get_max_connections() == 1,
        }
    }
}

impl Drop for PinnedCloudsyncConnection {
    fn drop(&mut self) {
        if self.release_on_drop {
            drop(self.guard.take());
        }
    }
}

impl OwnedSqliteConnection for PinnedCloudsyncConnection {
    fn sqlite_connection(&mut self) -> &mut SqliteConnection {
        self.guard.as_mut().expect("pinned CloudSync connection")
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
    Ok(ReservedConnection::new(PinnedCloudsyncConnection::new(
        pinned, pool,
    )))
}

pub(crate) fn release_pinned_connection(
    _pool: &SqlitePool,
    connection: ReservedConnection<PinnedCloudsyncConnection>,
) {
    drop(connection);
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;
    use std::time::Duration;

    #[tokio::test]
    async fn dropping_single_pool_pin_returns_its_connection() {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .unwrap();
        let slot = Arc::new(Mutex::new(Some(pool.acquire().await.unwrap())));
        let connection = reserve_pinned_connection(&pool, &slot).await.unwrap();

        assert!(pool.try_acquire().is_none());
        drop(connection);
        assert!(slot.lock().await.is_none());

        let connection = tokio::time::timeout(Duration::from_secs(1), pool.acquire())
            .await
            .expect("dropping the pinned reservation should return its connection")
            .unwrap();
        drop(connection);
        pool.close().await;
    }
}
