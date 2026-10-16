import assert from 'node:assert/strict';
import test from 'node:test';
import { migrateStorageKey } from './storage-key-migration.js';

function createStorage(initial = {}, { failWrite = false, corruptReadback = false } = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      const value = values.get(key);
      if (corruptReadback && key === 'armoreum-key' && value !== undefined) return `${value} `;
      return value ?? null;
    },
    setItem(key, value) {
      if (failWrite) throw new Error('QuotaExceededError');
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

const isTheme = (value) => ['system-auto-time', 'light', 'dark'].includes(value);

test('first migration copies a valid value, verifies it, then removes the old key', () => {
  const storage = createStorage({ 'legacy-key': 'dark' });
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'migrated');
  assert.equal(storage.values.get('armoreum-key'), 'dark');
  assert.equal(storage.values.has('legacy-key'), false);
});

test('repeated migration is idempotent and does not change current data', () => {
  const storage = createStorage({ 'armoreum-key': 'light' });
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'missing');
  storage.values.set('legacy-key', 'light');
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'already-present');
  assert.equal(storage.values.get('armoreum-key'), 'light');
  assert.equal(storage.values.has('legacy-key'), false);
});

test('malformed legacy data is preserved and not copied', () => {
  const storage = createStorage({ 'legacy-key': '{"theme":' });
  assert.equal(
    migrateStorageKey(storage, 'armoreum-key', 'legacy-key', (value) => {
      try {
        return isTheme(JSON.parse(value));
      } catch {
        return false;
      }
    }),
    'invalid-legacy',
  );
  assert.equal(storage.values.has('armoreum-key'), false);
  assert.equal(storage.values.get('legacy-key'), '{"theme":');
});

test('failed writes preserve the legacy value', () => {
  const storage = createStorage({ 'legacy-key': 'dark' }, { failWrite: true });
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'storage-unavailable');
  assert.equal(storage.values.has('armoreum-key'), false);
  assert.equal(storage.values.get('legacy-key'), 'dark');
});

test('failed readback verification keeps the legacy value and does not accept corrupt data', () => {
  const storage = createStorage({ 'legacy-key': 'dark' }, { corruptReadback: true });
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'verification-failed');
  assert.equal(storage.values.get('legacy-key'), 'dark');
});

test('a different valid current value is not overwritten and legacy data is retained', () => {
  const storage = createStorage({ 'armoreum-key': 'light', 'legacy-key': 'dark' });
  assert.equal(migrateStorageKey(storage, 'armoreum-key', 'legacy-key', isTheme), 'destination-conflict');
  assert.equal(storage.values.get('armoreum-key'), 'light');
  assert.equal(storage.values.get('legacy-key'), 'dark');
});
