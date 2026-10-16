/**
 * Copy a validated legacy browser-storage value into its current key.
 * The legacy value is removed only after the destination has been read back
 * and validated, so quota errors and partial writes preserve the source.
 *
 * @param {{ getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }} storage
 * @param {string} currentKey
 * @param {string} legacyKey
 * @param {(value: string) => boolean} validate
 * @returns {'missing' | 'migrated' | 'already-present' | 'invalid-legacy' | 'destination-conflict' | 'verification-failed' | 'storage-unavailable'}
 */
export function migrateStorageKey(storage, currentKey, legacyKey, validate) {
  try {
    const legacyValue = storage.getItem(legacyKey);
    if (legacyValue === null) return 'missing';
    if (!validate(legacyValue)) return 'invalid-legacy';

    const currentValue = storage.getItem(currentKey);
    if (currentValue !== null) {
      if (currentValue === legacyValue && validate(currentValue)) {
        storage.removeItem(legacyKey);
        return 'already-present';
      }
      return 'destination-conflict';
    }

    storage.setItem(currentKey, legacyValue);
    const writtenValue = storage.getItem(currentKey);
    if (writtenValue !== legacyValue || !validate(writtenValue)) {
      return 'verification-failed';
    }

    storage.removeItem(legacyKey);
    return 'migrated';
  } catch {
    return 'storage-unavailable';
  }
}
