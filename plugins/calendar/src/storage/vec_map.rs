// Insertion-ordered map mirroring JS `Map` semantics: `set` on an existing
// key keeps its original position, `get`/`delete` by key.
pub(crate) struct VecMap<K, V> {
    entries: Vec<(K, V)>,
}

impl<K: Eq, V> VecMap<K, V> {
    pub(crate) fn new() -> Self {
        VecMap {
            entries: Vec::new(),
        }
    }

    pub(crate) fn get(&self, key: &K) -> Option<&V> {
        self.entries.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }

    pub(crate) fn get_mut(&mut self, key: &K) -> Option<&mut V> {
        self.entries
            .iter_mut()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v)
    }

    pub(crate) fn contains_key(&self, key: &K) -> bool {
        self.entries.iter().any(|(k, _)| k == key)
    }

    pub(crate) fn set(&mut self, key: K, value: V) {
        if let Some((_, existing)) = self.entries.iter_mut().find(|(k, _)| *k == key) {
            *existing = value;
        } else {
            self.entries.push((key, value));
        }
    }

    pub(crate) fn remove(&mut self, key: &K) {
        self.entries.retain(|(k, _)| k != key);
    }

    pub(crate) fn iter(&self) -> impl Iterator<Item = &(K, V)> {
        self.entries.iter()
    }

    pub(crate) fn values(&self) -> impl Iterator<Item = &V> {
        self.entries.iter().map(|(_, v)| v)
    }

    pub(crate) fn len(&self) -> usize {
        self.entries.len()
    }
}

impl<K: Eq, V> Default for VecMap<K, V> {
    fn default() -> Self {
        Self::new()
    }
}
